import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { project_status, assigned_ops_lead_id, page = '1', limit = '25' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (project_status) { whereClause += ` AND c.project_status = $${idx++}`; params.push(project_status); }
    if (assigned_ops_lead_id) { whereClause += ` AND c.assigned_ops_lead_id = $${idx++}`; params.push(assigned_ops_lead_id); }

    if (req.user!.role === 'ops') {
      whereClause += ` AND c.assigned_ops_lead_id = $${idx++}`;
      params.push(req.user!.userId);
    }

    const countResult = await query(`SELECT COUNT(*) FROM clients c ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT c.*, ou.first_name as ops_first, ou.last_name as ops_last
       FROM clients c
       LEFT JOIN users ou ON c.assigned_ops_lead_id = ou.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({ data: result.rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const clientId = req.params.id;

    const result = await query('SELECT * FROM clients WHERE id = $1', [clientId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const client = result.rows[0];

    const [notes, milestones, activities, paymentLinks, files, deal] = await Promise.all([
      query(
        `SELECT pn.*, u.first_name as author_first, u.last_name as author_last
         FROM project_notes pn
         JOIN users u ON pn.author_id = u.id
         WHERE pn.client_id = $1
         ORDER BY pn.pinned DESC, pn.created_at DESC`,
        [clientId]
      ),
      query(
        `SELECT * FROM project_milestones WHERE client_id = $1 ORDER BY sort_order ASC`,
        [clientId]
      ),
      query(
        `SELECT * FROM activities WHERE client_id = $1 ORDER BY created_at DESC`,
        [clientId]
      ),
      query(
        `SELECT * FROM payment_links WHERE client_id = $1 ORDER BY created_at DESC`,
        [clientId]
      ),
      query(
        "SELECT * FROM files WHERE client_id = $1 AND visibility != 'private' ORDER BY created_at DESC",
        [clientId]
      ),
      client.deal_id
        ? query('SELECT * FROM deals WHERE id = $1', [client.deal_id])
        : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      client,
      deal: deal.rows[0] || null,
      notes: notes.rows,
      milestones: milestones.rows,
      activities: activities.rows,
      payment_links: paymentLinks.rows,
      files: files.rows,
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

router.patch('/:id', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      'project_name', 'services_contracted', 'assigned_ops_lead_id',
      'kickoff_date', 'expected_delivery_date', 'actual_delivery_date',
      'project_status', 'current_phase', 'revision_limit',
      'upsell_opportunity', 'upsell_notes',
      'handoff_notes', 'project_brief', 'project_goals',
      'target_audience', 'brand_guidelines', 'competitors', 'special_requirements',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
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
      `UPDATE clients SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'update',
      entityType: 'client',
      entityId: req.params.id,
      changes: req.body,
    });

    res.json({ client: result.rows[0] });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Convert deal to client
router.post('/from-deal/:dealId', requireRole('admin', 'closer', 'ops'), async (req: Request, res: Response) => {
  try {
    const deal = await query('SELECT * FROM deals WHERE id = $1', [req.params.dealId]);
    if (deal.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    const d = deal.rows[0];
    const existing = await query('SELECT id FROM clients WHERE deal_id = $1', [d.id]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Client already exists for this deal', client_id: existing.rows[0].id });
      return;
    }

    const {
      assigned_ops_lead_id, services_contracted, kickoff_date, expected_delivery_date,
      project_name, handoff_notes, project_brief, project_goals,
      target_audience, brand_guidelines, competitors, special_requirements,
    } = req.body;

    const result = await query(
      `INSERT INTO clients (deal_id, company_name, contact_name, contact_email, contact_phone,
       contract_value, assigned_closer_id, assigned_ops_lead_id, services_contracted,
       kickoff_date, expected_delivery_date, balance_due,
       project_name, handoff_notes, project_brief, project_goals,
       target_audience, brand_guidelines, competitors, special_requirements,
       handed_off_at, handed_off_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),$21)
       RETURNING *`,
      [
        d.id, d.company_name, d.contact_name, d.contact_email, d.contact_phone,
        d.actual_value || d.estimated_value, d.assigned_closer_id,
        assigned_ops_lead_id || null, services_contracted || null,
        kickoff_date || null, expected_delivery_date || null,
        d.actual_value || d.estimated_value,
        project_name || d.company_name,
        handoff_notes || null, project_brief || null,
        project_goals ? JSON.stringify(project_goals) : '[]',
        target_audience || null, brand_guidelines || null,
        competitors || null, special_requirements || null,
        req.user!.userId,
      ]
    );

    await logAudit({
      userId: req.user!.userId,
      action: 'create',
      entityType: 'client',
      entityId: result.rows[0].id,
    });

    res.status(201).json({ client: result.rows[0] });
  } catch (error) {
    console.error('Convert deal error:', error);
    res.status(500).json({ error: 'Failed to convert deal to client' });
  }
});

export default router;
