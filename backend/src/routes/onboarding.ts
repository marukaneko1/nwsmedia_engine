import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ── Staff endpoints (require auth) ──────────────────────────────

// Generate an onboarding link for a client
router.post(
  '/clients/:clientId/onboarding-link',
  authenticateToken,
  requireRole('ops', 'admin', 'closer'),
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;

      const client = await query('SELECT id, company_name FROM clients WHERE id = $1', [clientId]);
      if (client.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await query(
        `INSERT INTO onboarding_links (client_id, token, created_by_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [clientId, token, req.user!.userId, expiresAt]
      );

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = `${baseUrl}/onboarding/${token}`;

      res.status(201).json({ link, token, expires_at: expiresAt.toISOString() });
    } catch (error) {
      console.error('Generate onboarding link error:', error);
      res.status(500).json({ error: 'Failed to generate onboarding link' });
    }
  }
);

// List onboarding links for a client (staff view)
router.get(
  '/clients/:clientId/onboarding-links',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT ol.*, u.first_name as created_by_first, u.last_name as created_by_last
         FROM onboarding_links ol
         JOIN users u ON ol.created_by_id = u.id
         WHERE ol.client_id = $1
         ORDER BY ol.created_at DESC`,
        [req.params.clientId]
      );
      res.json({ links: result.rows });
    } catch (error) {
      console.error('List onboarding links error:', error);
      res.status(500).json({ error: 'Failed to list onboarding links' });
    }
  }
);

// ── Public endpoints (token-based auth) ─────────────────────────

// Get onboarding form data (client fills this out)
router.get('/onboarding/:token', async (req: Request, res: Response) => {
  try {
    const link = await query(
      `SELECT ol.*, c.company_name, c.contact_name, c.contact_email, c.contact_phone,
              c.project_name, c.services_contracted, c.contract_value,
              c.project_brief, c.target_audience, c.brand_guidelines,
              c.competitors, c.special_requirements, c.project_goals,
              c.business_description, c.business_hours,
              c.revenue_range, c.team_size, c.looking_for,
              c.social_facebook, c.social_instagram, c.social_linkedin,
              c.social_tiktok, c.social_youtube, c.social_twitter,
              c.existing_website, c.logo_url, c.color_preferences,
              c.content_tone, c.inspirations, c.additional_notes,
              c.onboarding_completed_at
       FROM onboarding_links ol
       JOIN clients c ON ol.client_id = c.id
       WHERE ol.token = $1`,
      [req.params.token]
    );

    if (link.rows.length === 0) {
      res.status(404).json({ error: 'Invalid onboarding link' });
      return;
    }

    const row = link.rows[0];

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.status(410).json({ error: 'This onboarding link has expired' });
      return;
    }

    res.json({
      company_name: row.company_name,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      project_name: row.project_name,
      services_contracted: row.services_contracted,
      project_brief: row.project_brief,
      target_audience: row.target_audience,
      brand_guidelines: row.brand_guidelines,
      competitors: row.competitors,
      special_requirements: row.special_requirements,
      project_goals: row.project_goals,
      business_description: row.business_description,
      business_hours: row.business_hours,
      revenue_range: row.revenue_range,
      team_size: row.team_size,
      looking_for: row.looking_for,
      social_facebook: row.social_facebook,
      social_instagram: row.social_instagram,
      social_linkedin: row.social_linkedin,
      social_tiktok: row.social_tiktok,
      social_youtube: row.social_youtube,
      social_twitter: row.social_twitter,
      existing_website: row.existing_website,
      logo_url: row.logo_url,
      color_preferences: row.color_preferences,
      content_tone: row.content_tone,
      inspirations: row.inspirations,
      additional_notes: row.additional_notes,
      onboarding_completed_at: row.onboarding_completed_at,
    });
  } catch (error) {
    console.error('Get onboarding data error:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding data' });
  }
});

// Submit onboarding form
router.post('/onboarding/:token', async (req: Request, res: Response) => {
  try {
    const link = await query(
      `SELECT ol.*, c.id as cid FROM onboarding_links ol
       JOIN clients c ON ol.client_id = c.id
       WHERE ol.token = $1`,
      [req.params.token]
    );

    if (link.rows.length === 0) {
      res.status(404).json({ error: 'Invalid onboarding link' });
      return;
    }

    const row = link.rows[0];

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.status(410).json({ error: 'This onboarding link has expired' });
      return;
    }

    const {
      contact_name, contact_email, contact_phone,
      company_name,
      business_description, business_hours,
      revenue_range, team_size, looking_for,
      target_audience, brand_guidelines, competitors, special_requirements,
      project_goals, content_tone, inspirations, additional_notes,
      social_facebook, social_instagram, social_linkedin,
      social_tiktok, social_youtube, social_twitter,
      existing_website, color_preferences,
    } = req.body;

    await query(
      `UPDATE clients SET
        contact_name = COALESCE($1, contact_name),
        contact_email = COALESCE($2, contact_email),
        contact_phone = COALESCE($3, contact_phone),
        company_name = COALESCE($4, company_name),
        business_description = $5,
        business_hours = $6,
        revenue_range = $7,
        team_size = $8,
        looking_for = $9,
        target_audience = $10,
        brand_guidelines = $11,
        competitors = $12,
        special_requirements = $13,
        project_goals = $14,
        content_tone = $15,
        inspirations = $16,
        additional_notes = $17,
        social_facebook = $18,
        social_instagram = $19,
        social_linkedin = $20,
        social_tiktok = $21,
        social_youtube = $22,
        social_twitter = $23,
        existing_website = $24,
        color_preferences = $25,
        onboarding_completed_at = NOW(),
        updated_at = NOW()
       WHERE id = $26`,
      [
        contact_name || null, contact_email || null, contact_phone || null,
        company_name || null,
        business_description || null, business_hours || null,
        revenue_range || null, team_size || null, looking_for || null,
        target_audience || null, brand_guidelines || null,
        competitors || null, special_requirements || null,
        project_goals ? JSON.stringify(project_goals) : '[]',
        content_tone || null, inspirations || null, additional_notes || null,
        social_facebook || null, social_instagram || null, social_linkedin || null,
        social_tiktok || null, social_youtube || null, social_twitter || null,
        existing_website || null, color_preferences || null,
        row.cid,
      ]
    );

    await query(
      'UPDATE onboarding_links SET completed_at = NOW() WHERE id = $1',
      [row.id]
    );

    res.json({ message: 'Onboarding completed successfully' });
  } catch (error) {
    console.error('Submit onboarding error:', error);
    res.status(500).json({ error: 'Failed to submit onboarding data' });
  }
});

// Get project status for client tracking (public, token-auth)
router.get('/onboarding/:token/project', async (req: Request, res: Response) => {
  try {
    const link = await query(
      `SELECT ol.client_id FROM onboarding_links ol WHERE ol.token = $1`,
      [req.params.token]
    );

    if (link.rows.length === 0) {
      res.status(404).json({ error: 'Invalid link' });
      return;
    }

    const clientId = link.rows[0].client_id;

    const [clientResult, milestones, payments] = await Promise.all([
      query(
        `SELECT company_name, contact_name, project_name, services_contracted,
                contract_value, project_status, current_phase,
                kickoff_date, expected_delivery_date, total_paid, balance_due,
                revision_limit, revisions_used
         FROM clients WHERE id = $1`,
        [clientId]
      ),
      query(
        `SELECT title, description, due_date, completed_at, sort_order
         FROM project_milestones WHERE client_id = $1 ORDER BY sort_order ASC`,
        [clientId]
      ),
      query(
        `SELECT payment_type, amount, status, due_date, paid_at
         FROM payment_links WHERE client_id = $1 ORDER BY created_at DESC`,
        [clientId]
      ),
    ]);

    if (clientResult.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({
      project: clientResult.rows[0],
      milestones: milestones.rows,
      payments: payments.rows,
    });
  } catch (error) {
    console.error('Get project status error:', error);
    res.status(500).json({ error: 'Failed to fetch project status' });
  }
});

export default router;
