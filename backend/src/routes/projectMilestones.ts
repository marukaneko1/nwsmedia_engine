import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/:clientId/milestones', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM project_milestones
       WHERE client_id = $1
       ORDER BY sort_order ASC`,
      [req.params.clientId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('List milestones error:', error);
    res.status(500).json({ error: 'Failed to list milestones' });
  }
});

router.post('/:clientId/milestones', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const { title, description, due_date, sort_order } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const result = await query(
      `INSERT INTO project_milestones (client_id, title, description, due_date, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.clientId, title, description || null, due_date || null, sort_order ?? 0]
    );

    res.status(201).json({ milestone: result.rows[0] });
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

router.patch('/:clientId/milestones/:milestoneId', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const allowedFields = ['title', 'description', 'due_date', 'completed_at', 'sort_order'];
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

    values.push(req.params.milestoneId, req.params.clientId);

    const result = await query(
      `UPDATE project_milestones SET ${updates.join(', ')}
       WHERE id = $${idx++} AND client_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json({ milestone: result.rows[0] });
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

router.post('/:clientId/milestones/:milestoneId/complete', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE project_milestones SET completed_at = NOW()
       WHERE id = $1 AND client_id = $2
       RETURNING *`,
      [req.params.milestoneId, req.params.clientId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json({ milestone: result.rows[0] });
  } catch (error) {
    console.error('Complete milestone error:', error);
    res.status(500).json({ error: 'Failed to complete milestone' });
  }
});

router.delete('/:clientId/milestones/:milestoneId', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM project_milestones WHERE id = $1 AND client_id = $2 RETURNING id',
      [req.params.milestoneId, req.params.clientId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

export default router;
