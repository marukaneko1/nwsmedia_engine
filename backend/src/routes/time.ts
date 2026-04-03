import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// ── Clock in ────────────────────────────────────────────────────────────
router.post('/clock-in', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { activity_type } = req.body;

    // Check for existing open entry
    const open = await query(
      `SELECT id FROM time_entries WHERE user_id = $1 AND clock_out IS NULL`,
      [userId]
    );
    if (open.rows.length > 0) {
      res.status(400).json({ error: 'Already clocked in. Clock out first.' });
      return;
    }

    const result = await query(
      `INSERT INTO time_entries (user_id, activity_type) VALUES ($1, $2) RETURNING *`,
      [userId, activity_type || 'other']
    );
    res.status(201).json({ entry: result.rows[0] });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// ── Clock out ───────────────────────────────────────────────────────────
router.post('/clock-out', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { notes } = req.body;

    const open = await query(
      `SELECT id, clock_in FROM time_entries WHERE user_id = $1 AND clock_out IS NULL`,
      [userId]
    );
    if (open.rows.length === 0) {
      res.status(400).json({ error: 'Not currently clocked in.' });
      return;
    }

    const entryId = open.rows[0].id;
    const clockIn = new Date(open.rows[0].clock_in);
    const now = new Date();
    const durationMinutes = Math.round((now.getTime() - clockIn.getTime()) / 60000);

    const result = await query(
      `UPDATE time_entries SET clock_out = NOW(), duration_minutes = $1, notes = COALESCE($2, notes)
       WHERE id = $3 RETURNING *`,
      [durationMinutes, notes || null, entryId]
    );
    res.json({ entry: result.rows[0] });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// ── Current status ──────────────────────────────────────────────────────
router.get('/current', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM time_entries WHERE user_id = $1 AND clock_out IS NULL LIMIT 1`,
      [req.user!.userId]
    );
    res.json({ entry: result.rows[0] || null });
  } catch (error) {
    console.error('Current status error:', error);
    res.status(500).json({ error: 'Failed to get current status' });
  }
});

// ── My entries (date range) ─────────────────────────────────────────────
router.get('/my-entries', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT * FROM time_entries
       WHERE user_id = $1 AND clock_in >= $2::date AND clock_in < ($3::date + INTERVAL '1 day')
       ORDER BY clock_in DESC`,
      [userId, from, to]
    );
    res.json({ entries: result.rows });
  } catch (error) {
    console.error('My entries error:', error);
    res.status(500).json({ error: 'Failed to get entries' });
  }
});

// ── Edit entry ──────────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { notes, activity_type } = req.body;
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(notes); }
    if (activity_type !== undefined) { fields.push(`activity_type = $${idx++}`); params.push(activity_type); }

    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    params.push(req.params.id, req.user!.userId);
    const result = await query(
      `UPDATE time_entries SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      params
    );

    if (result.rows.length === 0) { res.status(404).json({ error: 'Entry not found' }); return; }
    res.json({ entry: result.rows[0] });
  } catch (error) {
    console.error('Edit entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// ── Manual entry (add past time) ────────────────────────────────────────
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { clock_in, clock_out, activity_type, notes } = req.body;

    if (!clock_in || !clock_out) {
      res.status(400).json({ error: 'clock_in and clock_out are required' });
      return;
    }

    const start = new Date(clock_in);
    const end = new Date(clock_out);
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    if (durationMinutes <= 0) {
      res.status(400).json({ error: 'clock_out must be after clock_in' });
      return;
    }

    const result = await query(
      `INSERT INTO time_entries (user_id, clock_in, clock_out, duration_minutes, activity_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, clock_in, clock_out, durationMinutes, activity_type || 'other', notes || null]
    );
    res.status(201).json({ entry: result.rows[0] });
  } catch (error) {
    console.error('Manual entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// ── Admin: team entries ─────────────────────────────────────────────────
router.get('/team', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT te.*, u.first_name, u.last_name, u.role
       FROM time_entries te
       JOIN users u ON u.id = te.user_id
       WHERE te.clock_in >= $1::date AND te.clock_in < ($2::date + INTERVAL '1 day')
       ORDER BY te.clock_in DESC`,
      [from, to]
    );
    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Team entries error:', error);
    res.status(500).json({ error: 'Failed to get team entries' });
  }
});

// ── Admin: summary (aggregated hours per user per activity) ─────────────
router.get('/summary', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT
         u.id AS user_id,
         u.first_name,
         u.last_name,
         u.role,
         u.schedule,
         COALESCE(SUM(te.duration_minutes), 0)::int AS total_minutes,
         json_agg(json_build_object(
           'activity_type', te.activity_type,
           'minutes', te.duration_minutes,
           'clock_in', te.clock_in,
           'clock_out', te.clock_out,
           'notes', te.notes,
           'id', te.id
         ) ORDER BY te.clock_in) FILTER (WHERE te.id IS NOT NULL) AS entries,
         (SELECT json_object_agg(sub.activity_type, sub.mins)
          FROM (
            SELECT activity_type, COALESCE(SUM(duration_minutes), 0)::int AS mins
            FROM time_entries
            WHERE user_id = u.id AND clock_in >= $1::date AND clock_in < ($2::date + INTERVAL '1 day')
            GROUP BY activity_type
          ) sub
         ) AS activity_breakdown
       FROM users u
       LEFT JOIN time_entries te ON te.user_id = u.id
         AND te.clock_in >= $1::date AND te.clock_in < ($2::date + INTERVAL '1 day')
       WHERE u.status = 'active' AND u.role != 'admin'
       GROUP BY u.id, u.first_name, u.last_name, u.role, u.schedule
       ORDER BY u.first_name`,
      [from, to]
    );

    // Compute team-level stats
    const users = result.rows;
    const totalTeamMinutes = users.reduce((s: number, u: any) => s + u.total_minutes, 0);
    const activeUsers = users.filter((u: any) => u.total_minutes > 0);

    res.json({
      users,
      stats: {
        total_team_hours: +(totalTeamMinutes / 60).toFixed(1),
        avg_hours_per_person: activeUsers.length > 0 ? +((totalTeamMinutes / 60) / activeUsers.length).toFixed(1) : 0,
        active_count: activeUsers.length,
        top_performer: activeUsers.length > 0
          ? activeUsers.reduce((top: any, u: any) => u.total_minutes > top.total_minutes ? u : top)
          : null,
      },
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

export default router;
