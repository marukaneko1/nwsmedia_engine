import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// ── Admin: team schedule (all users + overrides for a week) ─────────────
router.get('/team', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const weekStart = req.query.week_start as string;
    let startDate: string;
    if (weekStart) {
      startDate = weekStart;
    } else {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(d.setDate(diff)).toISOString().split('T')[0];
    }

    const endDate = new Date(new Date(startDate).getTime() + 6 * 86400000).toISOString().split('T')[0];

    const users = await query(
      `SELECT id, first_name, last_name, role, schedule, status
       FROM users WHERE status = 'active' AND role != 'admin'
       ORDER BY first_name`
    );

    const overrides = await query(
      `SELECT so.*, u.first_name, u.last_name
       FROM schedule_overrides so
       JOIN users u ON u.id = so.user_id
       WHERE so.date >= $1 AND so.date <= $2
       ORDER BY so.date`,
      [startDate, endDate]
    );

    // Get logged hours for the week per user per day
    const hours = await query(
      `SELECT
         user_id,
         DATE(clock_in) AS day,
         COALESCE(SUM(duration_minutes), 0)::int AS minutes
       FROM time_entries
       WHERE clock_in >= $1::date AND clock_in < ($2::date + INTERVAL '1 day')
         AND clock_out IS NOT NULL
       GROUP BY user_id, DATE(clock_in)`,
      [startDate, endDate]
    );

    // Build a map: userId -> { date -> minutes }
    const hoursMap: Record<string, Record<string, number>> = {};
    for (const row of hours.rows) {
      if (!hoursMap[row.user_id]) hoursMap[row.user_id] = {};
      const dayStr = new Date(row.day).toISOString().split('T')[0];
      hoursMap[row.user_id][dayStr] = row.minutes;
    }

    // Build a map: userId -> { date -> override }
    const overrideMap: Record<string, Record<string, any>> = {};
    for (const row of overrides.rows) {
      if (!overrideMap[row.user_id]) overrideMap[row.user_id] = {};
      const dayStr = new Date(row.date).toISOString().split('T')[0];
      overrideMap[row.user_id][dayStr] = row;
    }

    res.json({
      week_start: startDate,
      week_end: endDate,
      users: users.rows.map((u: any) => ({
        ...u,
        overrides: overrideMap[u.id] || {},
        logged_hours: hoursMap[u.id] || {},
      })),
    });
  } catch (error) {
    console.error('Team schedule error:', error);
    res.status(500).json({ error: 'Failed to get team schedule' });
  }
});

// ── User schedule (self or admin viewing another user) ──────────────────
router.get('/user/:id', async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const isAdmin = req.user!.role === 'admin';
    const isSelf = targetId === req.user!.userId;

    if (!isAdmin && !isSelf) {
      res.status(403).json({ error: 'Can only view your own schedule' });
      return;
    }

    const userResult = await query(
      `SELECT id, first_name, last_name, role, schedule FROM users WHERE id = $1`,
      [targetId]
    );
    if (userResult.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }

    const overrides = await query(
      `SELECT * FROM schedule_overrides WHERE user_id = $1 AND date >= CURRENT_DATE ORDER BY date LIMIT 30`,
      [targetId]
    );

    res.json({ user: userResult.rows[0], overrides: overrides.rows });
  } catch (error) {
    console.error('User schedule error:', error);
    res.status(500).json({ error: 'Failed to get user schedule' });
  }
});

// ── Create schedule override ────────────────────────────────────────────
router.post('/overrides', async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const { user_id, date, start_time, end_time, reason, notes } = req.body;

    const targetUserId = isAdmin && user_id ? user_id : req.user!.userId;

    if (!date) { res.status(400).json({ error: 'date is required' }); return; }

    const result = await query(
      `INSERT INTO schedule_overrides (user_id, date, start_time, end_time, reason, notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, date) DO UPDATE SET
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         reason = EXCLUDED.reason,
         notes = EXCLUDED.notes,
         created_by_id = EXCLUDED.created_by_id
       RETURNING *`,
      [targetUserId, date, start_time || null, end_time || null, reason || 'custom', notes || null, req.user!.userId]
    );
    res.status(201).json({ override: result.rows[0] });
  } catch (error) {
    console.error('Create override error:', error);
    res.status(500).json({ error: 'Failed to create override' });
  }
});

// ── Delete schedule override ────────────────────────────────────────────
router.delete('/overrides/:id', async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'admin';
    let sql = `DELETE FROM schedule_overrides WHERE id = $1`;
    const params: unknown[] = [req.params.id];

    if (!isAdmin) {
      sql += ` AND user_id = $2`;
      params.push(req.user!.userId);
    }

    await query(sql, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete override error:', error);
    res.status(500).json({ error: 'Failed to delete override' });
  }
});

export default router;
