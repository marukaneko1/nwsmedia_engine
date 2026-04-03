import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeInput } from './middleware/sanitize';
import { query } from './config/database';
import type { AuthPayload } from './middleware/auth';
import { setNotificationIO } from './services/notifications';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import teamRoutes from './routes/teams';
import leadRoutes from './routes/leads';
import activityRoutes from './routes/activities';
import dealRoutes from './routes/deals';
import paymentRoutes from './routes/payments';
import commissionRoutes from './routes/commissions';
import clientRoutes from './routes/clients';
import analyticsRoutes from './routes/analytics';
import webhookRoutes from './routes/webhooks';
import portalRoutes from './routes/portal';
import gdprRoutes from './routes/gdpr';
import outboundWebhookRoutes from './routes/outboundWebhooks';
import notificationRoutes from './routes/notifications';
import sequenceRoutes from './routes/sequences';
import proposalRoutes from './routes/proposals';
import projectNoteRoutes from './routes/projectNotes';
import projectMilestoneRoutes from './routes/projectMilestones';
import pdfRoutes from './routes/pdf';
import onboardingRoutes from './routes/onboarding';
import inviteRoutes from './routes/invites';
import contractRoutes from './routes/contracts';
import chatRoutes from './routes/chat';
import meetingRoutes from './routes/meetings';
import timeRoutes from './routes/time';
import scheduleRoutes from './routes/schedule';
import trainingRoutes from './routes/training';
import searchRoutes from './routes/search';
import auditLogRoutes from './routes/auditLog';
import profileRoutes from './routes/profile';
import documentRoutes from './routes/documents';
import googleRoutes from './routes/google';
import googleCalendarRoutes from './routes/googleCalendar';
import gmailRoutes from './routes/gmail';
import dialerRoutes from './routes/dialer';
import voiceWebhookRoutes from './routes/voiceWebhooks';
import userActivityRoutes from './routes/userActivities';
import clientIntakeRoutes from './routes/clientIntake';
import simulatorRoutes from './routes/simulator';
import scraperRoutes from './routes/scraper';
import scraperLeadRoutes from './routes/scraperLeads';
import { activityTracker } from './middleware/activityTracker';

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ───────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: env.FRONTEND_URL, credentials: true },
});
app.set('io', io);

// JWT auth middleware for sockets
io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    (socket as any).user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

setNotificationIO(io);

io.on('connection', async (socket) => {
  const user: AuthPayload = (socket as any).user;
  if (!user) return socket.disconnect();

  // Join personal notification room
  socket.join(`user:${user.userId}`);

  // Track online status
  if (!onlineUsers.has(user.userId)) onlineUsers.set(user.userId, new Set());
  onlineUsers.get(user.userId)!.add(socket.id);

  // Auto-join all user's channels
  try {
    const channels = await query(
      `SELECT channel_id FROM channel_members WHERE user_id = $1`,
      [user.userId]
    );
    for (const row of channels.rows) {
      socket.join(`channel:${row.channel_id}`);
    }
  } catch (e) {
    console.error('Socket channel join error:', e);
  }

  // Broadcast online status
  io.emit('user_online', { userId: user.userId });

  // ── Send message ────────────────────────────────────────────────────
  socket.on('send_message', async (data: { channelId: string; content: string }, ack?: Function) => {
    try {
      const result = await query(
        `INSERT INTO messages (channel_id, sender_id, content, message_type)
         VALUES ($1, $2, $3, 'text') RETURNING *`,
        [data.channelId, user.userId, data.content]
      );
      const msg = result.rows[0];

      // Get sender info
      const senderResult = await query(
        `SELECT first_name, last_name, role FROM users WHERE id = $1`,
        [user.userId]
      );
      const sender = senderResult.rows[0];

      const fullMsg = {
        ...msg,
        sender_first: sender.first_name,
        sender_last: sender.last_name,
        sender_role: sender.role,
      };

      // Update sender's read marker
      await query(
        `UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2`,
        [data.channelId, user.userId]
      );

      io.to(`channel:${data.channelId}`).emit('new_message', fullMsg);
      if (ack) ack({ success: true, message: fullMsg });
    } catch (e) {
      console.error('Send message error:', e);
      if (ack) ack({ success: false });
    }
  });

  // ── Typing indicator ────────────────────────────────────────────────
  socket.on('typing', (data: { channelId: string }) => {
    socket.to(`channel:${data.channelId}`).emit('user_typing', {
      channelId: data.channelId,
      userId: user.userId,
    });
  });

  // ── Mark read ───────────────────────────────────────────────────────
  socket.on('mark_read', async (data: { channelId: string }) => {
    try {
      await query(
        `UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2`,
        [data.channelId, user.userId]
      );
    } catch (e) {
      console.error('Mark read error:', e);
    }
  });

  // ── Join new channel (when created/invited) ─────────────────────────
  socket.on('join_channel', (data: { channelId: string }) => {
    socket.join(`channel:${data.channelId}`);
  });

  // ── Disconnect ──────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(user.userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(user.userId);
        io.emit('user_offline', { userId: user.userId });
      }
    }
  });
});

// Expose online users via REST for the chat page
app.get('/api/chat/online', (_req, res) => {
  res.json({ online: Array.from(onlineUsers.keys()) });
});

// ── Express middleware ───────────────────────────────────────────────────

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(helmet());

const AUTH_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LIMIT_MAX = 10;
const authLimiter = rateLimit({
  windowMs: AUTH_LIMIT_WINDOW_MS,
  max: AUTH_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const resetTime = (_req as any).rateLimit?.resetTime;
    let minutesLeft = 15;
    if (resetTime) {
      minutesLeft = Math.max(1, Math.ceil((new Date(resetTime).getTime() - Date.now()) / 60000));
    }
    res.status(429).json({
      error: `Too many login attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      retryAfterMinutes: minutesLeft,
      locked: true,
    });
  },
});
app.use('/api/auth/login', authLimiter);

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Webhooks need raw body for signature verification (Stripe etc.)
app.use('/webhooks', express.raw({ type: 'application/json' }));
// Twilio voice webhooks send URL-encoded form data
app.use('/webhooks/voice', express.urlencoded({ extended: false }));

app.use(express.json({ limit: '50mb' }));
app.use(sanitizeInput);
app.use(activityTracker);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/payment-links', paymentRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/webhooks', outboundWebhookRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sequences', sequenceRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/projects', projectNoteRoutes);
app.use('/api/projects', projectMilestoneRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api', onboardingRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/calendar', googleCalendarRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/dialer', dialerRoutes);
app.use('/api/user-activities', userActivityRoutes);
app.use('/api/client-intake', clientIntakeRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/scraper', scraperLeadRoutes);

// Webhooks
app.use('/webhooks', webhookRoutes);
app.use('/webhooks', voiceWebhookRoutes);

// Error handler
app.use(errorHandler);

httpServer.listen(env.PORT, () => {
  console.log(`NWS CRM API running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

export { io };
export default app;
