import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { assigned_closer_id, stage, page = '1', limit = '25' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (assigned_closer_id) { whereClause += ` AND d.assigned_closer_id = $${idx++}`; params.push(assigned_closer_id); }
    if (stage) { whereClause += ` AND d.stage = $${idx++}`; params.push(stage); }

    if (req.user!.role === 'closer') {
      whereClause += ` AND d.assigned_closer_id = $${idx++}`;
      params.push(req.user!.userId);
    }

    const countResult = await query(`SELECT COUNT(*) FROM deals d ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT d.*, vu.first_name as va_first, vu.last_name as va_last,
              cu.first_name as closer_first, cu.last_name as closer_last
       FROM deals d
       LEFT JOIN users vu ON d.originating_va_id = vu.id
       LEFT JOIN users cu ON d.assigned_closer_id = cu.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({ data: result.rows, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('List deals error:', error);
    res.status(500).json({ error: 'Failed to list deals' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT d.*, vu.first_name as va_first, vu.last_name as va_last,
              cu.first_name as closer_first, cu.last_name as closer_last
       FROM deals d
       LEFT JOIN users vu ON d.originating_va_id = vu.id
       LEFT JOIN users cu ON d.assigned_closer_id = cu.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    const activities = await query(
      `SELECT a.*, u.first_name as created_by_first, u.last_name as created_by_last
       FROM activities a LEFT JOIN users u ON a.created_by_id = u.id
       WHERE a.deal_id = $1 ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    const paymentLinks = await query(
      `SELECT * FROM payment_links WHERE deal_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({ deal: result.rows[0], activities: activities.rows, payment_links: paymentLinks.rows });
  } catch (error) {
    console.error('Get deal error:', error);
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      'stage', 'estimated_value', 'actual_value', 'payment_terms',
      'discovery_call_date', 'pain_point', 'budget_range_min', 'budget_range_max',
      'timeline', 'decision_maker_name', 'objections',
      'proposal_sent_at', 'proposal_url', 'proposal_viewed_at', 'proposal_expires_at',
      'contract_sent_at', 'contract_signed_at', 'contract_url',
      'deposit_amount', 'deposit_due_date', 'close_probability',
      'loss_reason', 'competitor_name', 'competitor_price', 'loss_notes',
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

    if (req.body.stage === 'won') {
      updates.push(`close_date = NOW()`);
    }
    if (req.body.stage === 'lost') {
      updates.push(`close_date = NOW()`);
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await query(
      `UPDATE deals SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    // Log stage change as activity
    if (req.body.stage) {
      await query(
        `INSERT INTO activities (deal_id, activity_type, notes, created_by_id)
         VALUES ($1, 'stage_change', $2, $3)`,
        [req.params.id, `Stage changed to ${req.body.stage}`, req.user!.userId]
      );
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'update',
      entityType: 'deal',
      entityId: req.params.id,
      changes: req.body,
    });

    res.json({ deal: result.rows[0] });
  } catch (error) {
    console.error('Update deal error:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

export default router;
