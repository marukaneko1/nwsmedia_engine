import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ── Staff endpoints ──────────────────────────────────────────────

router.post(
  '/generate-link',
  authenticateToken,
  requireRole('admin', 'closer', 'ops'),
  async (req: Request, res: Response) => {
    try {
      const { label } = req.body;
      const token = crypto.randomBytes(32).toString('hex');

      const result = await query(
        `INSERT INTO client_intake_links (token, label, created_by_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [token, label || 'Client Intake Link', req.user!.userId]
      );

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = `${baseUrl}/intake/${token}`;

      res.status(201).json({ link, token, intake_link: result.rows[0] });
    } catch (error) {
      console.error('Generate intake link error:', error);
      res.status(500).json({ error: 'Failed to generate intake link' });
    }
  }
);

router.get(
  '/links',
  authenticateToken,
  requireRole('admin', 'closer', 'ops'),
  async (_req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT cil.*, u.first_name as creator_first, u.last_name as creator_last,
                (SELECT COUNT(*) FROM client_intake_submissions WHERE intake_link_id = cil.id) as submission_count
         FROM client_intake_links cil
         JOIN users u ON cil.created_by_id = u.id
         ORDER BY cil.created_at DESC`
      );
      res.json({ links: result.rows });
    } catch (error) {
      console.error('List intake links error:', error);
      res.status(500).json({ error: 'Failed to list intake links' });
    }
  }
);

router.delete(
  '/links/:id',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await query(
        'UPDATE client_intake_links SET is_active = FALSE WHERE id = $1',
        [req.params.id]
      );
      res.json({ message: 'Link deactivated' });
    } catch (error) {
      console.error('Deactivate intake link error:', error);
      res.status(500).json({ error: 'Failed to deactivate link' });
    }
  }
);

router.get(
  '/submissions',
  authenticateToken,
  requireRole('admin', 'closer', 'ops'),
  async (_req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT cis.*, cil.label as link_label
         FROM client_intake_submissions cis
         JOIN client_intake_links cil ON cis.intake_link_id = cil.id
         ORDER BY cis.created_at DESC
         LIMIT 200`
      );
      res.json({ submissions: result.rows });
    } catch (error) {
      console.error('List submissions error:', error);
      res.status(500).json({ error: 'Failed to list submissions' });
    }
  }
);

router.patch(
  '/submissions/:id/status',
  authenticateToken,
  requireRole('admin', 'closer', 'ops'),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'archived'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
        return;
      }
      await query(
        'UPDATE client_intake_submissions SET status = $1 WHERE id = $2',
        [status, req.params.id]
      );
      res.json({ message: 'Status updated' });
    } catch (error) {
      console.error('Update submission status error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

// ── Public endpoints ─────────────────────────────────────────────

router.get('/:token', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, label, is_active, expires_at FROM client_intake_links WHERE token = $1',
      [req.params.token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invalid intake link' });
      return;
    }

    const link = result.rows[0];

    if (!link.is_active) {
      res.status(410).json({ error: 'This intake link is no longer active' });
      return;
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      res.status(410).json({ error: 'This intake link has expired' });
      return;
    }

    res.json({ valid: true, label: link.label });
  } catch (error) {
    console.error('Validate intake link error:', error);
    res.status(500).json({ error: 'Failed to validate link' });
  }
});

router.post('/:token', async (req: Request, res: Response) => {
  try {
    const linkResult = await query(
      'SELECT id, is_active, expires_at FROM client_intake_links WHERE token = $1',
      [req.params.token]
    );

    if (linkResult.rows.length === 0) {
      res.status(404).json({ error: 'Invalid intake link' });
      return;
    }

    const link = linkResult.rows[0];

    if (!link.is_active) {
      res.status(410).json({ error: 'This intake link is no longer active' });
      return;
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      res.status(410).json({ error: 'This intake link has expired' });
      return;
    }

    const {
      client_name, business_name, email, phone,
      website, revenue_range, team_size, looking_for,
    } = req.body;

    if (!client_name || !business_name) {
      res.status(400).json({ error: 'Client name and business name are required' });
      return;
    }

    const result = await query(
      `INSERT INTO client_intake_submissions
        (intake_link_id, client_name, business_name, email, phone, website, revenue_range, team_size, looking_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        link.id,
        client_name, business_name,
        email || null, phone || null,
        website || null, revenue_range || null,
        team_size || null, looking_for || null,
      ]
    );

    res.status(201).json({ message: 'Thank you! Your information has been submitted.', submission: result.rows[0] });
  } catch (error) {
    console.error('Submit intake error:', error);
    res.status(500).json({ error: 'Failed to submit information' });
  }
});

export default router;
