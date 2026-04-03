import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.use(authenticateToken);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT t.*, u.first_name as lead_first_name, u.last_name as lead_last_name
       FROM teams t
       LEFT JOIN users u ON t.team_lead_id = u.id
       ORDER BY t.name`
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('List teams error:', error);
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const members = await query(
      `SELECT id, email, first_name, last_name, role, status FROM users WHERE team_id = $1`,
      [req.params.id]
    );

    res.json({ team: result.rows[0], members: members.rows });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, team_lead_id, territory } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const result = await query(
      `INSERT INTO teams (name, team_lead_id, territory) VALUES ($1, $2, $3) RETURNING *`,
      [name, team_lead_id || null, territory || null]
    );

    await logAudit({
      userId: req.user!.userId,
      action: 'create',
      entityType: 'team',
      entityId: result.rows[0].id,
    });

    res.status(201).json({ team: result.rows[0] });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, team_lead_id, territory } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (team_lead_id !== undefined) { updates.push(`team_lead_id = $${idx++}`); values.push(team_lead_id); }
    if (territory !== undefined) { updates.push(`territory = $${idx++}`); values.push(territory); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await query(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'update',
      entityType: 'team',
      entityId: req.params.id,
      changes: req.body,
    });

    res.json({ team: result.rows[0] });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await query('UPDATE users SET team_id = NULL WHERE team_id = $1', [req.params.id]);
    const result = await query('DELETE FROM teams WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: 'delete',
      entityType: 'team',
      entityId: req.params.id,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

export default router;
