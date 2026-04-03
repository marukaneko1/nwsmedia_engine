import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { env } from '../config/env';
import {
  getAuthUrl,
  exchangeCode,
  storeTokens,
  removeTokens,
  hasGoogleTokens,
  getOAuth2Client,
} from '../services/googleAuth';

const router = Router();

router.use(authenticateToken);

router.get('/auth-url', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.status(400).json({ error: 'Google OAuth not configured' });
    return;
  }
  const url = getAuthUrl(req.user!.userId);
  res.json({ url });
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(`${env.FRONTEND_URL}/${req.user?.role || 'admin'}/profile?google=error`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  try {
    const tokens = await exchangeCode(code as string);

    const client = getOAuth2Client();
    client.setCredentials(tokens);
    const { google } = require('googleapis');
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    await storeTokens(
      state as string,
      tokens.access_token!,
      tokens.refresh_token!,
      tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      tokens.scope?.split(' ') || [],
      profile.email || ''
    );

    const userRole = req.user?.role || 'admin';
    res.redirect(`${env.FRONTEND_URL}/${userRole}/profile?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${env.FRONTEND_URL}/${req.user?.role || 'admin'}/profile?google=error`);
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const token = await hasGoogleTokens(req.user!.userId);
    res.json({
      connected: !!token,
      google_email: token?.google_email || null,
    });
  } catch (err) {
    console.error('Google status error:', err);
    res.json({ connected: false, google_email: null });
  }
});

router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    await removeTokens(req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('Google disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
