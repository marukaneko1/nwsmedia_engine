import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { env } from '../config/env';
import { authenticateToken } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

function generateUsername(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

// Employee self-registration
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      first_name, last_name, password, personal_email, phone,
      role, date_of_birth, address_street, address_city, address_state, address_zip,
      join_date, schedule, emergency_contact_name, emergency_contact_phone, bio,
    } = req.body;

    if (!first_name || !last_name || !password || !personal_email || !phone || !role) {
      res.status(400).json({
        error: 'first_name, last_name, password, personal_email, phone, and role are required',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const validRoles = ['va', 'closer', 'ops'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
      return;
    }

    // Generate username from name (firstname.lastname)
    let username = generateUsername(first_name, last_name);

    // Check for username collision and append a number if needed
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

    // Use personal_email as the work email or generate one
    const workEmail = `${username}@nwsmediaemail.com`;

    const existingEmail = await query('SELECT id FROM users WHERE email = $1 OR personal_email = $2', [workEmail, personal_email]);
    if (existingEmail.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (
        email, username, password_hash, first_name, last_name, role, phone,
        personal_email, date_of_birth, address_street, address_city, address_state, address_zip,
        join_date, schedule, emergency_contact_name, emergency_contact_phone, bio,
        status, profile_completed
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'active',TRUE)
      RETURNING id, email, username, first_name, last_name, role, phone, personal_email,
                date_of_birth, join_date, schedule, status, profile_completed, created_at`,
      [
        workEmail, username, passwordHash, first_name, last_name, role, phone,
        personal_email, date_of_birth || null,
        address_street || null, address_city || null, address_state || null, address_zip || null,
        join_date || new Date().toISOString().split('T')[0],
        schedule ? JSON.stringify(schedule) : null,
        emergency_contact_name || null, emergency_contact_phone || null, bio || null,
      ]
    );

    const newUser = result.rows[0];

    await logAudit({
      userId: newUser.id,
      action: 'register',
      entityType: 'user',
      entityId: newUser.id,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
      userAgent: req.get('user-agent'),
    });

    // Auto-login after registration
    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role, email: newUser.email },
      env.JWT_SECRET,
      { expiresIn: '7d' as any }
    );

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [newUser.id]);

    res.status(201).json({ token, user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email/username and password are required' });
      return;
    }

    // Allow login by email OR username
    const result = await query(
      'SELECT * FROM users WHERE (email = $1 OR username = $1) AND status != $2',
      [email, 'deleted']
    );

    if (result.rows.length === 0) {
      const remaining = (req as any).rateLimit?.remaining;
      const msg = remaining != null && remaining <= 7
        ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
        : 'Invalid email or password';
      res.status(401).json({ error: msg, remainingAttempts: remaining ?? null });
      return;
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      const remaining = (req as any).rateLimit?.remaining;
      const msg = remaining != null && remaining <= 7
        ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
        : 'Invalid email or password';
      res.status(401).json({ error: msg, remainingAttempts: remaining ?? null });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' as any }
    );

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    await logAudit({
      userId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: Array.isArray(req.ip) ? req.ip[0] : req.ip,
      userAgent: req.get('user-agent'),
    });

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const token = jwt.sign(
      { userId: user.userId, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' as any }
    );
    res.json({ token });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  await logAudit({
    userId: req.user!.userId,
    action: 'logout',
    entityType: 'user',
    entityId: req.user!.userId,
  });
  res.json({ success: true });
});

router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, username, first_name, last_name, role, phone, personal_email,
              google_voice_number, personal_phone, preferred_phone,
              date_of_birth, address_street, address_city, address_state, address_zip,
              join_date, schedule, emergency_contact_name, emergency_contact_phone, bio,
              profile_completed, team_id, status, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
