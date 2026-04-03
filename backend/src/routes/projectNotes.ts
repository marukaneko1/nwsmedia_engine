import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/:clientId/notes', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT pn.*, u.first_name as author_first, u.last_name as author_last
       FROM project_notes pn
       JOIN users u ON pn.author_id = u.id
       WHERE pn.client_id = $1
       ORDER BY pn.pinned DESC, pn.created_at DESC`,
      [req.params.clientId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('List project notes error:', error);
    res.status(500).json({ error: 'Failed to list project notes' });
  }
});

router.post('/:clientId/notes', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const { content, note_type } = req.body;
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const validTypes = ['general', 'update', 'blocker', 'milestone_update'];
    const type = validTypes.includes(note_type) ? note_type : 'general';

    const result = await query(
      `INSERT INTO project_notes (client_id, author_id, content, note_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.clientId, req.user!.userId, content, type]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    console.error('Create project note error:', error);
    res.status(500).json({ error: 'Failed to create project note' });
  }
});

router.patch('/:clientId/notes/:noteId', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const { content, pinned } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (content !== undefined) {
      updates.push(`content = $${idx++}`);
      values.push(content);
    }
    if (pinned !== undefined) {
      updates.push(`pinned = $${idx++}`);
      values.push(pinned);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.noteId, req.params.clientId);

    const result = await query(
      `UPDATE project_notes SET ${updates.join(', ')}
       WHERE id = $${idx++} AND client_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({ note: result.rows[0] });
  } catch (error) {
    console.error('Update project note error:', error);
    res.status(500).json({ error: 'Failed to update project note' });
  }
});

router.delete('/:clientId/notes/:noteId', requireRole('ops', 'admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM project_notes WHERE id = $1 AND client_id = $2 RETURNING id',
      [req.params.noteId, req.params.clientId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete project note error:', error);
    res.status(500).json({ error: 'Failed to delete project note' });
  }
});

export default router;
