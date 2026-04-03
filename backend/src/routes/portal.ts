import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { env } from '../config/env';

const router = Router();

// Magic link request
router.post('/auth/request-link', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const client = await query('SELECT * FROM clients WHERE contact_email = $1', [email]);
    // Don't reveal if email exists
    if (client.rows.length === 0) {
      res.json({ message: 'If that email exists, we sent you a login link.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      'INSERT INTO portal_tokens (client_id, token, expires_at) VALUES ($1, $2, $3)',
      [client.rows[0].id, token, expiresAt]
    );

    // In production, send email with magic link. For now, return token in dev.
    const magicLink = `${env.FRONTEND_URL}/portal/auth/${token}`;

    if (env.NODE_ENV === 'development') {
      res.json({ message: 'Login link sent.', _dev_link: magicLink, _dev_token: token });
    } else {
      res.json({ message: 'If that email exists, we sent you a login link.' });
    }
  } catch (error) {
    console.error('Portal auth error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Verify magic link
router.get('/auth/:token', async (req: Request, res: Response) => {
  try {
    const portalToken = await query(
      'SELECT * FROM portal_tokens WHERE token = $1 AND expires_at > NOW()',
      [req.params.token]
    );

    if (portalToken.rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const pt = portalToken.rows[0];

    const sessionToken = jwt.sign(
      { clientId: pt.client_id, role: 'client' },
      env.JWT_SECRET,
      { expiresIn: '7d' as any }
    );

    await query('DELETE FROM portal_tokens WHERE id = $1', [pt.id]);
    await query('UPDATE clients SET portal_last_login_at = NOW() WHERE id = $1', [pt.client_id]);

    const client = await query('SELECT * FROM clients WHERE id = $1', [pt.client_id]);

    res.json({ token: sessionToken, client: client.rows[0] });
  } catch (error) {
    console.error('Portal verify error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Portal middleware
function portalAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (!decoded.clientId) {
      res.status(403).json({ error: 'Not a portal session' });
      return;
    }
    (req as any).clientId = decoded.clientId;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Portal dashboard
router.get('/dashboard', portalAuth, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId;
    const client = await query('SELECT * FROM clients WHERE id = $1', [clientId]);
    if (client.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const projects = await query('SELECT * FROM projects WHERE client_id = $1', [clientId]);
    const files = await query(
      "SELECT * FROM files WHERE client_id = $1 AND visibility IN ('client_portal', 'public') ORDER BY created_at DESC",
      [clientId]
    );
    const payments = await query(
      'SELECT * FROM payment_links WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );

    res.json({
      client: client.rows[0],
      projects: projects.rows,
      files: files.rows,
      payments: payments.rows,
    });
  } catch (error) {
    console.error('Portal dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Submit referral
router.post('/referrals/submit', portalAuth, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId;
    const { company_name, contact_name, contact_email, contact_phone, notes } = req.body;

    if (!company_name) {
      res.status(400).json({ error: 'company_name is required' });
      return;
    }

    const referral = await query(
      `INSERT INTO referrals (referred_by_client_id, company_name, contact_name, contact_email, contact_phone, notes, reward_type, reward_amount)
       VALUES ($1,$2,$3,$4,$5,$6,'credit',500) RETURNING *`,
      [clientId, company_name, contact_name || null, contact_email || null, contact_phone || null, notes || null]
    );

    // Auto-create lead from referral
    if (contact_email || contact_phone) {
      const names = (contact_name || '').split(' ');
      const lead = await query(
        `INSERT INTO leads (first_name, last_name, company_name, email, phone, source, source_detail, tags)
         VALUES ($1,$2,$3,$4,$5,'referral',$6, ARRAY['REFERRAL']) RETURNING id`,
        [names[0] || null, names.slice(1).join(' ') || null, company_name, contact_email || null, contact_phone || null, `Referred by client ${clientId}`]
      );

      await query('UPDATE referrals SET lead_id = $1 WHERE id = $2', [lead.rows[0].id, referral.rows[0].id]);
    }

    await query('UPDATE clients SET referrals_submitted = referrals_submitted + 1 WHERE id = $1', [clientId]);

    res.status(201).json({ referral: referral.rows[0] });
  } catch (error) {
    console.error('Submit referral error:', error);
    res.status(500).json({ error: 'Failed to submit referral' });
  }
});

// Submit revision request
router.post('/revisions/submit', portalAuth, async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).clientId;
    const { description } = req.body;

    if (!description) {
      res.status(400).json({ error: 'description is required' });
      return;
    }

    const client = await query('SELECT * FROM clients WHERE id = $1', [clientId]);
    if (client.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const c = client.rows[0];
    if (c.revisions_used >= c.revision_limit) {
      res.status(400).json({ error: 'Revision limit reached. Additional revisions incur extra charges.' });
      return;
    }

    // Log as activity
    await query(
      `INSERT INTO activities (client_id, activity_type, notes, created_by_id)
       VALUES ($1, 'note', $2, COALESCE((SELECT id FROM users WHERE role = 'admin' LIMIT 1), gen_random_uuid()))`,
      [clientId, `REVISION REQUEST: ${description}`]
    );

    await query('UPDATE clients SET revisions_used = revisions_used + 1, project_status = $1, updated_at = NOW() WHERE id = $2',
      ['revision_requested', clientId]);

    res.json({ message: 'Revision request submitted', revisions_remaining: c.revision_limit - c.revisions_used - 1 });
  } catch (error) {
    console.error('Submit revision error:', error);
    res.status(500).json({ error: 'Failed to submit revision' });
  }
});

export default router;
