import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAuthenticatedClient } from '../services/googleAuth';
import { query } from '../config/database';

const router = Router();
router.use(authenticateToken);

router.get('/events', async (req: Request, res: Response) => {
  const { start, end } = req.query;
  if (!start || !end) {
    res.status(400).json({ error: 'start and end query params required' });
    return;
  }

  const userId = req.user!.userId;
  const startDate = new Date(start as string);
  const endDate = new Date(end as string);

  const crmMeetings = await query(
    `SELECT m.id, m.title, m.description, m.scheduled_at, m.duration_minutes,
            m.google_meet_link, m.status, m.created_by_id,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM meetings m
     LEFT JOIN users u ON u.id = m.created_by_id
     WHERE m.scheduled_at >= $1 AND m.scheduled_at <= $2
       AND (m.created_by_id = $3 OR m.id IN (
         SELECT meeting_id FROM meeting_participants WHERE user_id = $3
       ))
     ORDER BY m.scheduled_at`,
    [startDate.toISOString(), endDate.toISOString(), userId]
  );

  const events: any[] = crmMeetings.rows.map((m: any) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    start: m.scheduled_at,
    end: new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 30) * 60000).toISOString(),
    source: 'crm',
    meetLink: m.google_meet_link,
    status: m.status,
    color: '#8b5cf6',
  }));

  try {
    const client = await getAuthenticatedClient(userId);
    if (client) {
      const { google } = require('googleapis');
      const calendar = google.calendar({ version: 'v3', auth: client });

      const gEvents = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      for (const e of gEvents.data.items || []) {
        const eventStart = e.start?.dateTime || e.start?.date;
        const eventEnd = e.end?.dateTime || e.end?.date;
        if (!eventStart) continue;

        events.push({
          id: e.id,
          title: e.summary || '(No title)',
          description: e.description || '',
          start: eventStart,
          end: eventEnd || eventStart,
          source: 'google',
          meetLink: e.hangoutLink || null,
          status: e.status,
          color: '#3b82f6',
          htmlLink: e.htmlLink,
          allDay: !e.start?.dateTime,
        });
      }
    }
  } catch (err) {
    console.error('Google Calendar fetch error:', err);
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  res.json({ events });
});

router.post('/events', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { title, description, start, end, attendees } = req.body;

  if (!title || !start || !end) {
    res.status(400).json({ error: 'title, start, and end are required' });
    return;
  }

  let googleEventId: string | null = null;
  let meetLink: string | null = null;

  try {
    const client = await getAuthenticatedClient(userId);
    if (client) {
      const { google } = require('googleapis');
      const calendar = google.calendar({ version: 'v3', auth: client });

      const event = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: {
          summary: title,
          description: description || '',
          start: { dateTime: new Date(start).toISOString() },
          end: { dateTime: new Date(end).toISOString() },
          attendees: attendees?.map((email: string) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: `nws-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });

      googleEventId = event.data.id;
      meetLink = event.data.conferenceData?.entryPoints?.[0]?.uri || null;
    }
  } catch (err) {
    console.error('Google Calendar create error:', err);
  }

  const durationMinutes = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000
  );

  const result = await query(
    `INSERT INTO meetings (title, description, scheduled_at, duration_minutes, google_meet_link, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, description || null, new Date(start).toISOString(), durationMinutes, meetLink, userId]
  );

  res.json({
    event: {
      ...result.rows[0],
      google_event_id: googleEventId,
      source: 'crm',
    },
  });
});

router.patch('/events/:id', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { source } = req.query;
  const { title, description, start, end } = req.body;

  if (source === 'google') {
    try {
      const client = await getAuthenticatedClient(userId);
      if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

      const { google } = require('googleapis');
      const calendar = google.calendar({ version: 'v3', auth: client });

      const patch: any = {};
      if (title) patch.summary = title;
      if (description !== undefined) patch.description = description;
      if (start) patch.start = { dateTime: new Date(start).toISOString() };
      if (end) patch.end = { dateTime: new Date(end).toISOString() };

      await calendar.events.patch({
        calendarId: 'primary',
        eventId: id,
        requestBody: patch,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Google Calendar update error:', err);
      res.status(500).json({ error: 'Failed to update Google event' });
    }
    return;
  }

  const updates: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (title) { updates.push(`title = $${idx++}`); params.push(title); }
  if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
  if (start) { updates.push(`scheduled_at = $${idx++}`); params.push(new Date(start).toISOString()); }
  if (start && end) {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    updates.push(`duration_minutes = $${idx++}`);
    params.push(mins);
  }

  if (updates.length === 0) { res.json({ success: true }); return; }

  params.push(id);
  await query(`UPDATE meetings SET ${updates.join(', ')} WHERE id = $${idx}`, params);
  res.json({ success: true });
});

router.delete('/events/:id', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { source } = req.query;

  if (source === 'google') {
    try {
      const client = await getAuthenticatedClient(userId);
      if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

      const { google } = require('googleapis');
      const calendar = google.calendar({ version: 'v3', auth: client });
      await calendar.events.delete({ calendarId: 'primary', eventId: id });
      res.json({ success: true });
    } catch (err) {
      console.error('Google Calendar delete error:', err);
      res.status(500).json({ error: 'Failed to delete Google event' });
    }
    return;
  }

  await query(`DELETE FROM meetings WHERE id = $1`, [id]);
  res.json({ success: true });
});

export default router;
