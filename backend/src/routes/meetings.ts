import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { isGoogleMeetConfigured, createMeetLink } from '../services/googleMeet';

const router = Router();
router.use(authenticateToken);

// ── Google Meet status ──────────────────────────────────────────────────
router.get('/google-status', (_req: Request, res: Response) => {
  res.json({ configured: isGoogleMeetConfigured() });
});

// ── List meetings for current user ──────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const showPast = req.query.past === 'true';

    let sql = `
      SELECT m.*,
             u.first_name AS creator_first, u.last_name AS creator_last,
             (SELECT json_agg(json_build_object(
                'user_id', mp.user_id,
                'status', mp.status,
                'first_name', pu.first_name,
                'last_name', pu.last_name
              )) FROM meeting_participants mp JOIN users pu ON pu.id = mp.user_id WHERE mp.meeting_id = m.id
             ) AS participants
      FROM meetings m
      JOIN users u ON u.id = m.created_by_id
      WHERE (m.created_by_id = $1 OR EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = $1))`;

    if (!showPast) {
      sql += ` AND m.scheduled_at >= NOW() - INTERVAL '1 hour' AND m.status != 'cancelled'`;
    }

    sql += ` ORDER BY m.scheduled_at ASC`;

    const result = await query(sql, [userId]);
    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('List meetings error:', error);
    res.status(500).json({ error: 'Failed to list meetings' });
  }
});

// ── Create meeting ──────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, scheduled_at, duration_minutes, recurrence, participant_ids } = req.body;

    if (!title || !scheduled_at) {
      res.status(400).json({ error: 'title and scheduled_at are required' });
      return;
    }

    // Create a meeting channel thread
    const channelResult = await query(
      `INSERT INTO channels (name, type, description, created_by_id) VALUES ($1, 'meeting', $2, $3) RETURNING id`,
      [`meeting-${title.substring(0, 30)}`, `Thread for: ${title}`, req.user!.userId]
    );
    const channelId = channelResult.rows[0].id;

    // Try to generate Google Meet link
    let meetLink: string | null = null;
    if (isGoogleMeetConfigured()) {
      const participantEmails: string[] = [];
      if (Array.isArray(participant_ids) && participant_ids.length > 0) {
        const emailResult = await query(`SELECT email FROM users WHERE id = ANY($1)`, [participant_ids]);
        participantEmails.push(...emailResult.rows.map((r: any) => r.email));
      }
      meetLink = await createMeetLink({
        title,
        startTime: scheduled_at,
        durationMinutes: duration_minutes || 30,
        attendeeEmails: participantEmails,
      });
    }

    const meetingResult = await query(
      `INSERT INTO meetings (title, description, scheduled_at, duration_minutes, recurrence, google_meet_link, channel_id, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description || null, scheduled_at, duration_minutes || 30, recurrence || 'none', meetLink, channelId, req.user!.userId]
    );
    const meeting = meetingResult.rows[0];

    // Add creator to channel + participants
    await query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [channelId, req.user!.userId]);
    await query(`INSERT INTO meeting_participants (meeting_id, user_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT DO NOTHING`, [meeting.id, req.user!.userId]);

    if (Array.isArray(participant_ids)) {
      for (const uid of participant_ids) {
        await query(`INSERT INTO meeting_participants (meeting_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [meeting.id, uid]);
        await query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [channelId, uid]);
      }
    }

    // Post a system message in the channel
    const link = meetLink ? `\nJoin: ${meetLink}` : '';
    await query(
      `INSERT INTO messages (channel_id, sender_id, content, message_type) VALUES ($1, $2, $3, 'meeting_link')`,
      [channelId, req.user!.userId, `Meeting scheduled: ${title} at ${new Date(scheduled_at).toLocaleString()}${link}`]
    );

    res.status(201).json({ meeting });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// ── Update meeting ──────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, scheduled_at, duration_minutes, status } = req.body;
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
    if (scheduled_at !== undefined) { fields.push(`scheduled_at = $${idx++}`); params.push(scheduled_at); }
    if (duration_minutes !== undefined) { fields.push(`duration_minutes = $${idx++}`); params.push(duration_minutes); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); params.push(status); }

    if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    params.push(req.params.id);
    const result = await query(`UPDATE meetings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);

    if (result.rows.length === 0) { res.status(404).json({ error: 'Meeting not found' }); return; }
    res.json({ meeting: result.rows[0] });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// ── Cancel meeting ──────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query(`UPDATE meetings SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel meeting error:', error);
    res.status(500).json({ error: 'Failed to cancel meeting' });
  }
});

// ── RSVP ────────────────────────────────────────────────────────────────
router.post('/:id/rsvp', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      res.status(400).json({ error: 'status must be accepted or declined' });
      return;
    }
    await query(
      `UPDATE meeting_participants SET status = $1 WHERE meeting_id = $2 AND user_id = $3`,
      [status, req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('RSVP error:', error);
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

export default router;
