import { Router, Request, Response } from 'express';
import {
  generateVoiceTwiML,
  handleVoiceStatusCallback,
  handleRecordingCallback,
} from '../services/twilioVoice';

const router = Router();

// TwiML App webhook: returns XML for inbound/outbound call routing
// This is called by Twilio when a call is initiated via the Voice SDK
router.post('/voice/twiml', async (req: Request, res: Response) => {
  try {
    const twiml = await generateVoiceTwiML(req.body);
    res.type('text/xml').send(twiml);
  } catch (error: any) {
    console.error('TwiML webhook error:', error.message);
    res.type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We are unable to take your call right now. Please try again later.</Say>
  <Hangup/>
</Response>`
    );
  }
});

// Voice status callback: called by Twilio for call state changes
router.post('/voice/status', async (req: Request, res: Response) => {
  try {
    await handleVoiceStatusCallback(req.body);
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Voice status callback error:', error.message);
    res.status(200).send('OK');
  }
});

// Recording callback: called by Twilio when a recording is available
router.post('/voice/recording', async (req: Request, res: Response) => {
  try {
    await handleRecordingCallback(req.body);
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Recording callback error:', error.message);
    res.status(200).send('OK');
  }
});

export default router;
