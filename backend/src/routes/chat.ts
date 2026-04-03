import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// File upload setup
const uploadDir = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── List channels for current user ──────────────────────────────────────
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT c.*,
              cm.last_read_at,
              (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) AS member_count,
              lm.content AS last_message_content,
              lm.created_at AS last_message_at,
              lu.first_name AS last_message_sender_first,
              lu.last_name AS last_message_sender_last,
              (SELECT COUNT(*) FROM messages m
               WHERE m.channel_id = c.id AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')) AS unread_count
       FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $1
       LEFT JOIN LATERAL (
         SELECT content, created_at, sender_id FROM messages WHERE channel_id = c.id ORDER BY created_at DESC LIMIT 1
       ) lm ON TRUE
       LEFT JOIN users lu ON lu.id = lm.sender_id
       ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
      [userId]
    );

    res.json({ channels: result.rows });
  } catch (error) {
    console.error('List channels error:', error);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

// ── Create channel (admin) ──────────────────────────────────────────────
router.post('/channels', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, description, member_ids } = req.body;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    const result = await query(
      `INSERT INTO channels (name, type, description, created_by_id) VALUES ($1, 'team', $2, $3) RETURNING *`,
      [name, description || null, req.user!.userId]
    );
    const channel = result.rows[0];

    // Add creator
    await query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [channel.id, req.user!.userId]);

    // Add specified members
    if (Array.isArray(member_ids)) {
      for (const uid of member_ids) {
        await query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [channel.id, uid]);
      }
    }

    res.status(201).json({ channel });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// ── Get or create DM channel ────────────────────────────────────────────
router.get('/dm/:userId', async (req: Request, res: Response) => {
  try {
    const myId = req.user!.userId;
    const otherId = req.params.userId;

    // Find existing DM channel between these two users
    const existing = await query(
      `SELECT c.* FROM channels c
       WHERE c.type = 'direct'
         AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $1)
         AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2)
         AND (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) = 2`,
      [myId, otherId]
    );

    if (existing.rows.length > 0) {
      res.json({ channel: existing.rows[0] });
      return;
    }

    // Get other user's name for the channel
    const otherUser = await query(`SELECT first_name, last_name FROM users WHERE id = $1`, [otherId]);
    if (otherUser.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }

    const me = await query(`SELECT first_name, last_name FROM users WHERE id = $1`, [myId]);
    const name = `${me.rows[0].first_name} & ${otherUser.rows[0].first_name}`;

    const result = await query(
      `INSERT INTO channels (name, type, created_by_id) VALUES ($1, 'direct', $2) RETURNING *`,
      [name, myId]
    );
    const channel = result.rows[0];

    await query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)`, [channel.id, myId]);
    await query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)`, [channel.id, otherId]);

    res.json({ channel });
  } catch (error) {
    console.error('Get DM error:', error);
    res.status(500).json({ error: 'Failed to get DM channel' });
  }
});

// ── Get messages for a channel (paginated) ──────────────────────────────
router.get('/channels/:id/messages', async (req: Request, res: Response) => {
  try {
    const channelId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    let sql = `
      SELECT m.*, u.first_name AS sender_first, u.last_name AS sender_last, u.role AS sender_role
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.channel_id = $1`;
    const params: unknown[] = [channelId];

    if (before) {
      sql += ` AND m.created_at < $${params.length + 1}`;
      params.push(before);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// ── Add member to channel ───────────────────────────────────────────────
router.post('/channels/:id/members', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;
    await query(
      `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, user_id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// ── Mark channel as read ────────────────────────────────────────────────
router.patch('/channels/:id/read', async (req: Request, res: Response) => {
  try {
    await query(
      `UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark channel as read' });
  }
});

// ── Upload file to channel ──────────────────────────────────────────────
router.post('/channels/:id/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const result = await query(
      `INSERT INTO messages (channel_id, sender_id, content, message_type, file_url, file_name, file_type)
       VALUES ($1, $2, $3, 'file', $4, $5, $6) RETURNING *`,
      [req.params.id, req.user!.userId, req.body.caption || null, fileUrl, req.file.originalname, req.file.mimetype]
    );

    // Update read marker
    await query(
      `UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.userId]
    );

    const sender = await query('SELECT first_name, last_name, role FROM users WHERE id = $1', [req.user!.userId]);
    const fullMsg = {
      ...result.rows[0],
      sender_first: sender.rows[0]?.first_name ?? '',
      sender_last: sender.rows[0]?.last_name ?? '',
      sender_role: sender.rows[0]?.role ?? '',
    };

    // Broadcast via socket for real-time delivery
    const io = req.app.get('io');
    if (io) io.to(`channel:${req.params.id}`).emit('new_message', fullMsg);

    res.status(201).json({ message: fullMsg });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// ── Get channel members ─────────────────────────────────────────────────
router.get('/channels/:id/members', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.role, u.status, cm.joined_at
       FROM channel_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.channel_id = $1 ORDER BY u.first_name`,
      [req.params.id]
    );
    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// ── Get all users (for DM picker) ──────────────────────────────────────
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, role, status FROM users WHERE status = 'active' AND id != $1 ORDER BY first_name`,
      [req.user!.userId]
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

export default router;
