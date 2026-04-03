import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// GET /templates - list active proposal templates
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM proposal_templates WHERE active = true ORDER BY created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('List proposal templates error:', error);
    res.status(500).json({ error: 'Failed to list proposal templates' });
  }
});

// GET /templates/:id - get single template
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM proposal_templates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Get proposal template error:', error);
    res.status(500).json({ error: 'Failed to fetch proposal template' });
  }
});

// POST /templates - create template (admin only)
router.post('/templates', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, services, total, timeline, description } = req.body;

    const result = await query(
      `INSERT INTO proposal_templates (name, services, total, timeline, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, JSON.stringify(services), total, timeline, description || null]
    );

    res.status(201).json({ template: result.rows[0] });
  } catch (error) {
    console.error('Create proposal template error:', error);
    res.status(500).json({ error: 'Failed to create proposal template' });
  }
});

// PATCH /templates/:id - update template (admin only)
router.patch('/templates/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, services, total, timeline, description, active } = req.body;

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); params.push(name); }
    if (services !== undefined) { fields.push(`services = $${idx++}`); params.push(JSON.stringify(services)); }
    if (total !== undefined) { fields.push(`total = $${idx++}`); params.push(total); }
    if (timeline !== undefined) { fields.push(`timeline = $${idx++}`); params.push(timeline); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (active !== undefined) { fields.push(`active = $${idx++}`); params.push(active); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await query(
      `UPDATE proposal_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Update proposal template error:', error);
    res.status(500).json({ error: 'Failed to update proposal template' });
  }
});

// DELETE /templates/:id - soft-delete template (admin only)
router.delete('/templates/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE proposal_templates SET active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({ message: 'Template deactivated' });
  } catch (error) {
    console.error('Delete proposal template error:', error);
    res.status(500).json({ error: 'Failed to delete proposal template' });
  }
});

export default router;
