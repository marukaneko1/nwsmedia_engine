import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { env } from '../config/env';
import { logAudit } from '../services/audit';

const router = Router();

// ── Admin: create invite link ───────────────────────────────────────────────
router.post(
  '/',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { role, email, label, expires_in_days, max_uses } = req.body;

      const validRoles = ['va', 'closer', 'ops'];
      if (!role || !validRoles.includes(role)) {
        res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const isUniversal = max_uses === null || max_uses === undefined || max_uses === 0;
      const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
        : isUniversal
          ? new Date(Date.now() + 365 * 86400000).toISOString()
          : new Date(Date.now() + 7 * 86400000).toISOString();

      const result = await query(
        `INSERT INTO invite_links (token, role, email, label, created_by_id, expires_at, max_uses, use_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
         RETURNING *`,
        [token, role, email || null, label || null, req.user!.userId, expiresAt, isUniversal ? null : (max_uses || 1)]
      );

      const link = `${env.FRONTEND_URL || 'http://localhost:5173'}/invite/${token}`;

      res.status(201).json({ invite: result.rows[0], link });
    } catch (error) {
      console.error('Create invite error:', error);
      res.status(500).json({ error: 'Failed to create invite link' });
    }
  }
);

// ── Admin: list invites ─────────────────────────────────────────────────────
router.get(
  '/',
  authenticateToken,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT il.*,
                u.first_name AS creator_first, u.last_name AS creator_last,
                ru.first_name AS used_first, ru.last_name AS used_last
         FROM invite_links il
         JOIN users u ON u.id = il.created_by_id
         LEFT JOIN users ru ON ru.id = il.used_by_id
         ORDER BY il.created_at DESC`
      );
      res.json({ invites: result.rows });
    } catch (error) {
      console.error('List invites error:', error);
      res.status(500).json({ error: 'Failed to list invites' });
    }
  }
);

// ── Admin: revoke invite ────────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await query(
        `UPDATE invite_links SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
        [req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Revoke invite error:', error);
      res.status(500).json({ error: 'Failed to revoke invite' });
    }
  }
);

// ── Public: verify invite token ─────────────────────────────────────────────
router.get('/verify/:token', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, role, email, label, expires_at, used_at, revoked_at, max_uses, use_count FROM invite_links WHERE token = $1`,
      [req.params.token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invalid invite link' });
      return;
    }

    const invite = result.rows[0];
    const isUniversal = invite.max_uses === null;

    if (!isUniversal && invite.used_at) {
      res.status(410).json({ error: 'This invite link has already been used' });
      return;
    }
    if (!isUniversal && invite.max_uses !== null && (invite.use_count || 0) >= invite.max_uses) {
      res.status(410).json({ error: 'This invite link has reached its usage limit' });
      return;
    }
    if (invite.revoked_at) {
      res.status(410).json({ error: 'This invite link has been revoked' });
      return;
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      res.status(410).json({ error: 'This invite link has expired' });
      return;
    }

    res.json({
      valid: true,
      role: invite.role,
      email: invite.email,
      label: invite.label,
      universal: isUniversal,
    });
  } catch (error) {
    console.error('Verify invite error:', error);
    res.status(500).json({ error: 'Failed to verify invite' });
  }
});

// ── Public: register via invite token ───────────────────────────────────────
router.post('/register/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const {
      first_name, last_name, password, personal_email, phone,
      date_of_birth, address_street, address_city, address_state, address_zip,
      join_date, schedule, emergency_contact_name, emergency_contact_phone, bio,
    } = req.body;

    // Validate invite
    const inviteResult = await query(
      `SELECT * FROM invite_links WHERE token = $1`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      res.status(404).json({ error: 'Invalid invite link' });
      return;
    }

    const invite = inviteResult.rows[0];
    const isUniversal = invite.max_uses === null;

    if (!isUniversal && invite.used_at) {
      res.status(410).json({ error: 'This invite has already been used' });
      return;
    }
    if (!isUniversal && invite.max_uses !== null && (invite.use_count || 0) >= invite.max_uses) {
      res.status(410).json({ error: 'This invite has reached its usage limit' });
      return;
    }
    if (invite.revoked_at) {
      res.status(410).json({ error: 'This invite has been revoked' });
      return;
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      res.status(410).json({ error: 'This invite has expired' });
      return;
    }

    if (!first_name || !last_name || !password || !personal_email || !phone) {
      res.status(400).json({ error: 'first_name, last_name, password, personal_email, and phone are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Generate username
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

    const workEmail = `${username}@nwsmediaemail.com`;

    const existingEmail = await query(
      'SELECT id FROM users WHERE email = $1 OR personal_email = $2',
      [workEmail, personal_email]
    );
    if (existingEmail.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await query(
      `INSERT INTO users (
        email, username, password_hash, first_name, last_name, role, phone,
        personal_email, date_of_birth, address_street, address_city, address_state, address_zip,
        join_date, schedule, emergency_contact_name, emergency_contact_phone, bio,
        status, profile_completed
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'active',TRUE)
      RETURNING id, email, username, first_name, last_name, role, phone, personal_email,
                date_of_birth, join_date, schedule, status, profile_completed, created_at`,
      [
        workEmail, username, passwordHash, first_name, last_name, invite.role, phone,
        personal_email, date_of_birth || null,
        address_street || null, address_city || null, address_state || null, address_zip || null,
        join_date || new Date().toISOString().split('T')[0],
        schedule ? JSON.stringify(schedule) : null,
        emergency_contact_name || null, emergency_contact_phone || null, bio || null,
      ]
    );

    const newUser = userResult.rows[0];

    if (isUniversal) {
      await query(
        `UPDATE invite_links SET use_count = COALESCE(use_count, 0) + 1 WHERE id = $1`,
        [invite.id]
      );
    } else {
      await query(
        `UPDATE invite_links SET used_by_id = $1, used_at = NOW(), use_count = COALESCE(use_count, 0) + 1 WHERE id = $2`,
        [newUser.id, invite.id]
      );
    }

    await logAudit({
      userId: newUser.id,
      action: 'register_via_invite',
      entityType: 'user',
      entityId: newUser.id,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
      userAgent: req.get('user-agent'),
    });

    const jwtToken = jwt.sign(
      { userId: newUser.id, role: newUser.role, email: newUser.email },
      env.JWT_SECRET,
      { expiresIn: '7d' as any }
    );

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [newUser.id]);

    res.status(201).json({ token: jwtToken, user: newUser });
  } catch (error) {
    console.error('Invite registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
