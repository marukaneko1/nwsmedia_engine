import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const { action, entity_type, user_id, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (action) { where += ` AND a.action = $${idx++}`; params.push(action); }
    if (entity_type) { where += ` AND a.entity_type = $${idx++}`; params.push(entity_type); }
    if (user_id) { where += ` AND a.user_id = $${idx++}`; params.push(user_id); }

    const countResult = await query(`SELECT COUNT(*) FROM audit_log a ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limitNum, offset);
    const result = await query(
      `SELECT a.*, u.first_name, u.last_name, u.role AS user_role
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({
      data: result.rows,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [actions, entities, recent24h] = await Promise.all([
      query(`SELECT action, COUNT(*) FROM audit_log GROUP BY action ORDER BY count DESC`),
      query(`SELECT entity_type, COUNT(*) FROM audit_log WHERE entity_type IS NOT NULL GROUP BY entity_type ORDER BY count DESC`),
      query(`SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours'`),
    ]);

    res.json({
      actions: actions.rows,
      entities: entities.rows,
      last24h: parseInt(recent24h.rows[0].count, 10),
    });
  } catch (error) {
    console.error('Audit stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
