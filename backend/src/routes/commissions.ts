import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, status, page = '1', limit = '25' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (user_id) { whereClause += ` AND c.user_id = $${idx++}`; params.push(user_id); }
    if (status) { whereClause += ` AND c.status = $${idx++}`; params.push(status); }

    // Non-admin users see only their own commissions
    if (req.user!.role !== 'admin') {
      whereClause += ` AND c.user_id = $${idx++}`;
      params.push(req.user!.userId);
    }

    const countResult = await query(`SELECT COUNT(*) FROM commissions c ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const totalsResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.commission_amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.commission_amount ELSE 0 END), 0) as total_paid
       FROM commissions c ${whereClause}`,
      params
    );

    params.push(limitNum, offset);
    const result = await query(
      `SELECT c.*, u.first_name, u.last_name, u.role as user_role,
              d.company_name as deal_company
       FROM commissions c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN deals d ON c.deal_id = d.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({
      data: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      total_pending: parseFloat(totalsResult.rows[0].total_pending),
      total_paid: parseFloat(totalsResult.rows[0].total_paid),
    });
  } catch (error) {
    console.error('List commissions error:', error);
    res.status(500).json({ error: 'Failed to list commissions' });
  }
});

router.get('/export', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { user_id, start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (user_id) { whereClause += ` AND c.user_id = $${idx++}`; params.push(user_id); }
    if (start_date) { whereClause += ` AND c.created_at >= $${idx++}`; params.push(start_date); }
    if (end_date) { whereClause += ` AND c.created_at <= $${idx++}`; params.push(end_date); }

    const result = await query(
      `SELECT c.created_at, u.first_name, u.last_name, u.role as user_role,
              d.company_name as deal_company, c.deal_value, c.commission_percentage,
              c.commission_amount, c.status
       FROM commissions c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN deals d ON c.deal_id = d.id
       ${whereClause}
       ORDER BY c.created_at DESC`,
      params
    );

    const header = '"Date","Employee","Role","Deal","Deal Value","Commission %","Commission Amount","Status"';
    const rows = result.rows.map(r => {
      const date = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '';
      const employee = `${r.first_name || ''} ${r.last_name || ''}`.trim();
      return `"${date}","${employee}","${r.user_role || ''}","${r.deal_company || ''}","${r.deal_value || 0}","${r.commission_percentage || 0}","${r.commission_amount || 0}","${r.status || ''}"`;
    });

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="commissions-export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Commission CSV export error:', error);
    res.status(500).json({ error: 'Failed to export commissions' });
  }
});

router.patch('/:id/approve', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE commissions SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Commission not found or not pending' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'approve',
      entityType: 'commission',
      entityId: req.params.id,
    });

    res.json({ commission: result.rows[0] });
  } catch (error) {
    console.error('Approve commission error:', error);
    res.status(500).json({ error: 'Failed to approve commission' });
  }
});

router.post('/payout', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { commission_ids, payout_date, payout_method } = req.body;

    if (!Array.isArray(commission_ids) || commission_ids.length === 0) {
      res.status(400).json({ error: 'commission_ids array is required' });
      return;
    }

    const placeholders = commission_ids.map((_: string, i: number) => `$${i + 1}`).join(',');
    const result = await query(
      `UPDATE commissions SET status = 'paid', payout_date = $${commission_ids.length + 1},
       payout_method = $${commission_ids.length + 2}, paid_at = NOW(), updated_at = NOW()
       WHERE id IN (${placeholders}) AND status = 'approved'
       RETURNING *`,
      [...commission_ids, payout_date || new Date().toISOString().split('T')[0], payout_method || 'ach']
    );

    await logAudit({
      userId: req.user!.userId,
      action: 'payout',
      entityType: 'commission',
      changes: { ids: { old: null, new: commission_ids } },
    });

    res.json({ paid: result.rows.length, commissions: result.rows });
  } catch (error) {
    console.error('Commission payout error:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

export default router;
