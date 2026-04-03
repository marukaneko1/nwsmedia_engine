import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.use(authenticateToken);

router.get('/closers', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name FROM users WHERE role = 'closer' AND status = 'active' ORDER BY first_name`
    );
    res.json({ closers: result.rows });
  } catch (error) {
    console.error('List closers error:', error);
    res.status(500).json({ error: 'Failed to list closers' });
  }
});

router.get('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { role, status, team_id, page = '1', limit = '25' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE status != $1';
    const params: unknown[] = ['deleted'];
    let paramIdx = 2;

    if (role) {
      whereClause += ` AND role = $${paramIdx++}`;
      params.push(role);
    }
    if (status) {
      whereClause += ` AND status = $${paramIdx++}`;
      params.push(status);
    }
    if (team_id) {
      whereClause += ` AND team_id = $${paramIdx++}`;
      params.push(team_id);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT id, email, username, first_name, last_name, role, phone, personal_email,
              google_voice_number, personal_phone, preferred_phone,
              date_of_birth, address_city, address_state, join_date, schedule,
              emergency_contact_name, emergency_contact_phone, bio,
              profile_completed, team_id, status, last_login_at, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    );

    res.json({
      data: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.get('/admin-overview', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const [usersRes, roleCountsRes, recentActivityRes, onlineRes] = await Promise.all([
      query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status,
               u.last_login_at, u.created_at, u.team_id, u.profile_completed,
               t.name AS team_name,
               (SELECT COUNT(*) FROM leads l WHERE l.assigned_va_id = u.id AND l.stage NOT IN ('lost','converted')) AS active_leads,
               (SELECT COUNT(*) FROM deals d WHERE d.assigned_closer_id = u.id AND d.stage NOT IN ('won','lost')) AS active_deals,
               (SELECT MAX(a.created_at) FROM audit_log a WHERE a.user_id = u.id) AS last_activity_at,
               (SELECT a.action || ' ' || COALESCE(a.entity_type,'') FROM audit_log a WHERE a.user_id = u.id ORDER BY a.created_at DESC LIMIT 1) AS last_action
        FROM users u
        LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.status != 'deleted'
        ORDER BY u.last_login_at DESC NULLS LAST
      `),
      query(`SELECT role, COUNT(*) FROM users WHERE status != 'deleted' GROUP BY role`),
      query(`
        SELECT a.action, a.entity_type, a.created_at, u.first_name, u.last_name, u.role AS user_role
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT 15
      `),
      query(`SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours' AND status = 'active'`),
    ]);

    const roleCounts: Record<string, number> = {};
    for (const r of roleCountsRes.rows) roleCounts[r.role] = parseInt(r.count);

    res.json({
      users: usersRes.rows,
      roleCounts,
      recentActivity: recentActivityRes.rows,
      onlineLast24h: parseInt(onlineRes.rows[0].count),
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to get admin overview' });
  }
});

router.get('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, username, first_name, last_name, role, phone, personal_email,
              google_voice_number, personal_phone, preferred_phone,
              date_of_birth, address_street, address_city, address_state, address_zip,
              join_date, schedule, emergency_contact_name, emergency_contact_phone, bio,
              profile_completed, team_id, status, last_login_at, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const {
      email, password, first_name, last_name, role, phone, team_id,
      personal_email, join_date, schedule, emergency_contact_name, emergency_contact_phone,
    } = req.body;

    if (!email || !password || !first_name || !last_name || !role) {
      res.status(400).json({ error: 'email, password, first_name, last_name, and role are required' });
      return;
    }

    const validRoles = ['va', 'closer', 'ops', 'admin', 'client'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    // Generate username from name
    let username = `${first_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${last_name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUsername.rows.length > 0) {
      let suffix = 2;
      while (true) {
        const candidate = `${username}${suffix}`;
        const check = await query('SELECT id FROM users WHERE username = $1', [candidate]);
        if (check.rows.length === 0) { username = candidate; break; }
        suffix++;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, role, phone, team_id,
       personal_email, join_date, schedule, emergency_contact_name, emergency_contact_phone, profile_completed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
       RETURNING id, email, username, first_name, last_name, role, phone, personal_email,
                 join_date, schedule, team_id, status, profile_completed, created_at`,
      [
        email, username, passwordHash, first_name, last_name, role, phone || null, team_id || null,
        personal_email || null, join_date || new Date().toISOString().split('T')[0],
        schedule ? JSON.stringify(schedule) : null,
        emergency_contact_name || null, emergency_contact_phone || null,
      ]
    );

    await logAudit({
      userId: req.user!.userId,
      action: 'create',
      entityType: 'user',
      entityId: result.rows[0].id,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      'first_name', 'last_name', 'role', 'phone', 'personal_email',
      'google_voice_number', 'personal_phone', 'preferred_phone', 'team_id', 'status',
      'date_of_birth', 'address_street', 'address_city', 'address_state', 'address_zip',
      'join_date', 'schedule', 'emergency_contact_name', 'emergency_contact_phone', 'bio',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, email, username, first_name, last_name, role, phone, personal_email,
                 join_date, schedule, profile_completed, team_id, status, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'update',
      entityType: 'user',
      entityId: req.params.id,
      changes: req.body,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const result = await query(
      `UPDATE users SET status = 'deleted', email = 'deleted-' || id || '@nwsmedia.com',
       first_name = 'Deleted', last_name = 'User', phone = NULL,
       google_voice_number = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'delete',
      entityType: 'user',
      entityId: req.params.id,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
