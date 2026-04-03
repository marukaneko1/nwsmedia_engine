import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  generateVoiceTokenForUser,
  makeCall,
  makeRealVoiceCall,
  getUserCallHistory,
  saveCallHistoryManual,
  syncCallHistoryFromTwilio,
  getCallRecording,
  getCallRecordingAdmin,
  getAllCallRecordings,
  getCallDetails,
  getCallRecordings,
  updateCallStatus,
  getDialerSettings,
  updateDialerSettings,
  getPhoneAssignments,
  createPhoneAssignment,
  updatePhoneAssignment,
  deletePhoneAssignment,
  generateConferenceTwiML,
  checkRateLimit,
} from '../services/twilioVoice';

const router = Router();

router.use(authenticateToken);

// ═══════════════ Voice Token ═══════════════

router.post('/voice/token', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const identity = req.body.identity || req.user!.email || `user-${userId}`;

    if (!checkRateLimit(`token:${userId}`, 60_000, 10)) {
      res.status(429).json({ error: 'Token rate limit exceeded. Max 10 per minute.' });
      return;
    }

    const result = await generateVoiceTokenForUser(userId, identity);
    res.json(result);
  } catch (error: any) {
    console.error('Voice token error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ═══════════════ Make Calls ═══════════════

router.post('/voice/call', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!checkRateLimit(`call:${userId}`, 60_000, 10)) {
      res.status(429).json({ error: 'Call rate limit exceeded. Max 10 per minute.' });
      return;
    }

    const result = await makeCall(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Make call error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

router.post('/voice/real-call', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!checkRateLimit(`call:${userId}`, 60_000, 10)) {
      res.status(429).json({ error: 'Call rate limit exceeded. Max 10 per minute.' });
      return;
    }

    const result = await makeRealVoiceCall(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Real voice call error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ═══════════════ Call History ═══════════════

router.get('/voice/call-history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const syncFromTwilio = req.query.sync === 'true' || req.query.sync === '1';
    const page = req.query.page ? parseInt(req.query.page as string) : 1;

    const result = await getUserCallHistory(userId, limit, syncFromTwilio, page, {
      search: (req.query.search as string) || '',
      direction: (req.query.direction as string) || '',
      status: (req.query.status as string) || '',
      fromDate: (req.query.fromDate as string) || '',
      toDate: (req.query.toDate as string) || '',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Call history error:', error.message);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

router.post('/voice/sync-call-history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const result = await syncCallHistoryFromTwilio(userId, limit);
    res.json(result);
  } catch (error: any) {
    console.error('Sync call history error:', error.message);
    res.status(500).json({ error: 'Failed to sync call history' });
  }
});

router.post('/voice/save-call-history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await saveCallHistoryManual(req.body, userId);
    res.json(result);
  } catch (error: any) {
    console.error('Save call history error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════ Call Details & Updates ═══════════════

router.get('/voice/call/:callSid', async (req: Request, res: Response) => {
  try {
    const result = await getCallDetails(req.params.callSid, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/voice/call/:callSid', async (req: Request, res: Response) => {
  try {
    const result = await getCallDetails(req.params.callSid, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/voice/call/:callSid', async (req: Request, res: Response) => {
  try {
    const result = await updateCallStatus(req.params.callSid, req.body.status, req.body.credentials);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ═══════════════ Recordings ═══════════════

router.get('/voice/recording/:callSid', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await getCallRecording(req.params.callSid, userId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/voice/call/:callSid/recordings', async (req: Request, res: Response) => {
  try {
    const result = await getCallRecordings(req.params.callSid, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ═══════════════ Admin Recordings ═══════════════

router.get('/voice/admin/all-recordings', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await getAllCallRecordings(limit, page, {
      search: req.query.search as string,
      direction: req.query.direction as string,
      status: req.query.status as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/voice/admin/recording/:callSid', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await getCallRecordingAdmin(req.params.callSid);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ═══════════════ Conference TwiML ═══════════════

router.get('/voice/join-conference/:conferenceName', async (req: Request, res: Response) => {
  try {
    const twiML = generateConferenceTwiML(req.params.conferenceName);
    res.json({ twiML, conferenceName: req.params.conferenceName });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ═══════════════ Dialer Settings ═══════════════

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await getDialerSettings(req.user!.userId);
    res.json(settings);
  } catch (error: any) {
    console.error('Get dialer settings error:', error.message);
    res.status(500).json({ error: 'Failed to fetch dialer settings' });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await updateDialerSettings(req.user!.userId, req.body);
    res.json(settings);
  } catch (error: any) {
    console.error('Update dialer settings error:', error.message);
    res.status(500).json({ error: 'Failed to update dialer settings' });
  }
});

// ═══════════════ Phone Assignments ═══════════════

router.get('/phone-assignments', async (req: Request, res: Response) => {
  try {
    const assignments = await getPhoneAssignments(req.user!.userId);
    res.json({ data: assignments });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch phone assignments' });
  }
});

router.post('/phone-assignments', async (req: Request, res: Response) => {
  try {
    const assignment = await createPhoneAssignment({
      ...req.body,
      userId: req.user!.userId,
    });
    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/phone-assignments/:id', async (req: Request, res: Response) => {
  try {
    const assignment = await updatePhoneAssignment(req.params.id, req.body);
    res.json(assignment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/phone-assignments/:id', async (req: Request, res: Response) => {
  try {
    const result = await deletePhoneAssignment(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
