import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// GET / - list all sequences with enrollment counts
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT s.*,
        COUNT(se.id) FILTER (WHERE se.status = 'active') as active_enrollments,
        COUNT(se.id) as total_enrollments
       FROM sequences s
       LEFT JOIN sequence_enrollments se ON se.sequence_id = s.id
       GROUP BY s.id
       ORDER BY s.created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('List sequences error:', error);
    res.status(500).json({ error: 'Failed to list sequences' });
  }
});

// GET /:id - get single sequence with enrollments
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const seq = await query('SELECT * FROM sequences WHERE id = $1', [req.params.id]);
    if (seq.rows.length === 0) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    const enrollments = await query(
      `SELECT se.*, l.company_name as lead_company, l.contact_name as lead_contact
       FROM sequence_enrollments se
       LEFT JOIN leads l ON l.id = se.lead_id
       WHERE se.sequence_id = $1
       ORDER BY se.enrolled_at DESC`,
      [req.params.id]
    );

    res.json({ sequence: seq.rows[0], enrollments: enrollments.rows });
  } catch (error) {
    console.error('Get sequence error:', error);
    res.status(500).json({ error: 'Failed to fetch sequence' });
  }
});

// POST / - create sequence (admin only)
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, sequence_type, steps, description, trigger_event, trigger_delay_days } = req.body;

    const result = await query(
      `INSERT INTO sequences (name, sequence_type, steps, description, trigger_event, trigger_delay_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, sequence_type, JSON.stringify(steps), description || null, trigger_event || null, trigger_delay_days || 0]
    );

    res.status(201).json({ sequence: result.rows[0] });
  } catch (error) {
    console.error('Create sequence error:', error);
    res.status(500).json({ error: 'Failed to create sequence' });
  }
});

// PATCH /:id - update sequence (admin only)
router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, steps, is_active, description, sequence_type } = req.body;

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); params.push(name); }
    if (steps !== undefined) { fields.push(`steps = $${idx++}`); params.push(JSON.stringify(steps)); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(is_active); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (sequence_type !== undefined) { fields.push(`sequence_type = $${idx++}`); params.push(sequence_type); }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    fields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await query(
      `UPDATE sequences SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    res.json({ sequence: result.rows[0] });
  } catch (error) {
    console.error('Update sequence error:', error);
    res.status(500).json({ error: 'Failed to update sequence' });
  }
});

// DELETE /:id - delete sequence (admin only)
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM sequences WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }
    res.json({ message: 'Sequence deleted' });
  } catch (error) {
    console.error('Delete sequence error:', error);
    res.status(500).json({ error: 'Failed to delete sequence' });
  }
});

// POST /:id/enroll - enroll a lead/deal into a sequence
router.post('/:id/enroll', requireRole('va', 'closer', 'admin'), async (req: Request, res: Response) => {
  try {
    const { lead_id, deal_id, trigger } = req.body;

    if (!lead_id && !deal_id) {
      res.status(400).json({ error: 'Either lead_id or deal_id is required' });
      return;
    }

    const seq = await query('SELECT * FROM sequences WHERE id = $1', [req.params.id]);
    if (seq.rows.length === 0) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }

    const sequence = seq.rows[0];
    const steps = typeof sequence.steps === 'string' ? JSON.parse(sequence.steps) : sequence.steps;
    const firstStep = steps?.[0];
    const delayDays = firstStep?.delay_days ?? 0;

    const result = await query(
      `INSERT INTO sequence_enrollments (sequence_id, lead_id, deal_id, current_step, next_send_at, status)
       VALUES ($1, $2, $3, 0, NOW() + INTERVAL '1 day' * $4, 'active')
       RETURNING *`,
      [req.params.id, lead_id || null, deal_id || null, delayDays]
    );

    res.status(201).json({ enrollment: result.rows[0], trigger: trigger || null });
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({ error: 'Failed to enroll in sequence' });
  }
});

// POST /enrollments/:enrollmentId/cancel - cancel an enrollment
router.post('/enrollments/:enrollmentId/cancel', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE sequence_enrollments
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [req.params.enrollmentId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Active enrollment not found' });
      return;
    }

    res.json({ enrollment: result.rows[0] });
  } catch (error) {
    console.error('Cancel enrollment error:', error);
    res.status(500).json({ error: 'Failed to cancel enrollment' });
  }
});

export default router;
