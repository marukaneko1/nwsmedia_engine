import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { lead_id, deal_id, client_id, activity_type, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (lead_id) { whereClause += ` AND a.lead_id = $${idx++}`; params.push(lead_id); }
    if (deal_id) { whereClause += ` AND a.deal_id = $${idx++}`; params.push(deal_id); }
    if (client_id) { whereClause += ` AND a.client_id = $${idx++}`; params.push(client_id); }
    if (activity_type) { whereClause += ` AND a.activity_type = $${idx++}`; params.push(activity_type); }

    params.push(limitNum, offset);
    const result = await query(
      `SELECT a.*, u.first_name as created_by_first, u.last_name as created_by_last
       FROM activities a
       LEFT JOIN users u ON a.created_by_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('List activities error:', error);
    res.status(500).json({ error: 'Failed to list activities' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      lead_id, deal_id, client_id, activity_type, outcome,
      call_duration_seconds, call_recording_url, phone_number_used,
      email_subject, notes,
    } = req.body;

    if (!activity_type) {
      res.status(400).json({ error: 'activity_type is required' });
      return;
    }

    if (!lead_id && !deal_id && !client_id) {
      res.status(400).json({ error: 'At least one of lead_id, deal_id, or client_id is required' });
      return;
    }

    const result = await query(
      `INSERT INTO activities (lead_id, deal_id, client_id, activity_type, outcome,
       call_duration_seconds, call_recording_url, phone_number_used,
       email_subject, notes, created_by_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        lead_id || null, deal_id || null, client_id || null,
        activity_type, outcome || null, call_duration_seconds || null,
        call_recording_url || null, phone_number_used || null,
        email_subject || null, notes || null, req.user!.userId,
      ]
    );

    // Update lead's last_contacted_at and contact_attempts
    if (lead_id && ['call', 'email', 'sms'].includes(activity_type)) {
      await query(
        `UPDATE leads SET last_contacted_at = NOW(), contact_attempts = contact_attempts + 1, updated_at = NOW() WHERE id = $1`,
        [lead_id]
      );
    }

    res.status(201).json({ activity: result.rows[0] });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

export default router;
