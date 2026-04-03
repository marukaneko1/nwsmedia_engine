import twilio from 'twilio';
import jwt from 'twilio/lib/jwt/AccessToken';
import { query } from '../config/database';
import { env } from '../config/env';

const { VoiceGrant } = jwt;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  appSid?: string;
  identity?: string;
}

export interface MakeCallParams {
  to: string;
  from: string;
  credentials: TwilioCredentials;
  twiml?: string;
  url?: string;
  statusCallback?: string;
  statusCallbackEvent?: string[];
  statusCallbackMethod?: string;
  callType?: string;
}

export interface CallHistoryRow {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  start_time: Date | null;
  end_time: Date | null;
  duration: number | null;
  direction: string;
  status: string;
  recording_url: string | null;
  recording_sid: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createClient(creds: TwilioCredentials) {
  return twilio(creds.accountSid, creds.authToken);
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function formatE164(phone: string): string {
  if (!phone) return phone;
  if (phone.startsWith('+')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// In-memory rate limit store (same pattern as source project)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) rateLimitStore.delete(key);
  }
}, 60_000);

export function checkRateLimit(key: string, windowMs: number, maxRequests: number): boolean {
  const now = Date.now();
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= maxRequests;
}

// ─── Active call tracking (in-memory) ───────────────────────────────────────

const activeCalls = new Map<string, { conferenceName: string; callSid: string; recipientNumber: string }>();

function setActiveCall(userId: string | null, conferenceName: string, callSid: string, recipientNumber: string) {
  if (userId) activeCalls.set(userId, { conferenceName, callSid, recipientNumber });
}

export function getActiveCall(userId: string) {
  return activeCalls.get(userId) || null;
}

export function clearActiveCall(userId: string) {
  activeCalls.delete(userId);
}

// ─── Voice Token ────────────────────────────────────────────────────────────

export async function generateVoiceTokenForUser(userId: string, identity: string) {
  const userResult = await query(
    `SELECT twilio_account_sid, twilio_auth_token, twilio_api_key_sid,
            twilio_api_key_secret, twilio_app_sid
     FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) throw new Error('User not found');

  const accountSid = user.twilio_account_sid || env.TWILIO_ACCOUNT_SID;
  const apiKeySid = user.twilio_api_key_sid || env.TWILIO_API_KEY_SID;
  const apiKeySecret = user.twilio_api_key_secret || env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = user.twilio_app_sid || env.TWILIO_TWIML_APP_SID;

  if (!apiKeySid || !apiKeySecret) {
    throw new Error('Twilio API Key SID and Secret are required for voice token generation');
  }
  if (!accountSid) {
    throw new Error('Twilio Account SID is required for voice token generation');
  }

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid || undefined,
    incomingAllow: true,
  });

  const token = new jwt(accountSid, apiKeySid, apiKeySecret, { identity });
  token.addGrant(voiceGrant);

  return {
    token: token.toJwt(),
    expiresIn: 3600,
    identity,
  };
}

// ─── Make Call (conference approach) ────────────────────────────────────────

export async function makeRealVoiceCall(params: MakeCallParams) {
  const { to, from, credentials } = params;

  if (!to || !from) throw new Error('Phone numbers are required');
  if (!credentials?.accountSid || !credentials?.authToken) {
    throw new Error('Twilio credentials are required');
  }

  const baseUrl = env.API_BASE_URL;
  const conferenceName = `web-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const recipientTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while we connect you.</Say>
  <Dial timeout="30" record="record-from-answer" recordingStatusCallback="${baseUrl}/webhooks/voice/recording">
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.none">${conferenceName}</Conference>
  </Dial>
</Response>`;

  const client = createClient(credentials);
  const recipientCall = await client.calls.create({
    to,
    from,
    twiml: recipientTwiML,
    statusCallback: `${baseUrl}/webhooks/voice/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'no-answer', 'busy', 'failed', 'canceled'],
    statusCallbackMethod: 'POST',
    record: true,
    recordingChannels: 'dual',
    recordingStatusCallback: `${baseUrl}/webhooks/voice/recording`,
  });

  // Link active call to user via phone assignment
  const assignmentResult = await query(
    `SELECT user_id FROM phone_assignments WHERE phone_number = $1 AND is_active = true LIMIT 1`,
    [from]
  );
  if (assignmentResult.rows[0]?.user_id) {
    setActiveCall(assignmentResult.rows[0].user_id, conferenceName, recipientCall.sid, to);
  }

  return {
    callSid: recipientCall.sid,
    conferenceName,
    status: recipientCall.status,
    from: recipientCall.from,
    to: recipientCall.to,
    direction: recipientCall.direction,
    dateCreated: recipientCall.dateCreated,
    callType: 'person-to-person',
    webCallInfo: {
      callType: 'web-conference',
      conferenceName,
      joinUrl: `${baseUrl}/api/dialer/voice/join-conference/${conferenceName}`,
      tokenEndpoint: `${baseUrl}/api/dialer/voice/token`,
    },
  };
}

export async function makeCall(params: MakeCallParams) {
  const { to, from, twiml, url, statusCallback, statusCallbackEvent, statusCallbackMethod, callType = 'person-to-person', credentials } = params;

  if (callType === 'person-to-person') {
    return makeRealVoiceCall(params);
  }

  const client = createClient(credentials);
  const baseUrl = env.API_BASE_URL;
  const callTwiML = twiml || `<Response><Dial callerId="${from}" timeout="30">${to}</Dial></Response>`;

  const call = await client.calls.create({
    to,
    from,
    twiml: callTwiML,
    url,
    statusCallback: statusCallback || `${baseUrl}/webhooks/voice/status`,
    statusCallbackEvent: statusCallbackEvent || ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: statusCallbackMethod || 'POST',
    record: true,
    recordingChannels: 'dual',
    recordingStatusCallback: `${baseUrl}/webhooks/voice/recording`,
  });

  return {
    callSid: call.sid,
    status: call.status,
    from: call.from,
    to: call.to,
    direction: call.direction,
    dateCreated: call.dateCreated,
    callType,
  };
}

// ─── Call History (DB) ──────────────────────────────────────────────────────

export async function saveCallHistory(callData: {
  callSid: string;
  fromNumber: string;
  toNumber: string;
  direction: string;
  status: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  recordingUrl?: string;
  recordingSid?: string;
  userId?: string;
}) {
  const { callSid, fromNumber, toNumber, direction, status, startTime, endTime, duration, recordingUrl, recordingSid } = callData;

  // Resolve userId from phone assignment if not provided
  let userId: string | null = callData.userId || null;

  if (!userId) {
    const isInbound = direction?.toLowerCase() === 'inbound' || direction?.toLowerCase() === 'incoming';
    const phoneToCheck = isInbound ? toNumber : fromNumber;

    if (phoneToCheck && !phoneToCheck.startsWith('client:')) {
      const assignResult = await query(
        `SELECT user_id FROM phone_assignments WHERE phone_number = $1 AND is_active = true LIMIT 1`,
        [phoneToCheck]
      );
      if (assignResult.rows[0]?.user_id) {
        userId = assignResult.rows[0].user_id;
      } else {
        // Fallback: try the other number
        const fallback = isInbound ? fromNumber : toNumber;
        if (fallback && !fallback.startsWith('client:')) {
          const fbResult = await query(
            `SELECT user_id FROM phone_assignments WHERE phone_number = $1 AND is_active = true LIMIT 1`,
            [fallback]
          );
          if (fbResult.rows[0]?.user_id) userId = fbResult.rows[0].user_id;
        }
      }
    }
  }

  // Upsert
  const existing = await query(`SELECT * FROM call_history WHERE call_sid = $1`, [callSid]);

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    await query(
      `UPDATE call_history SET
         status = $1,
         start_time = COALESCE($2, start_time),
         end_time = COALESCE($3, end_time),
         duration = COALESCE($4, duration),
         recording_url = COALESCE($5, recording_url),
         recording_sid = COALESCE($6, recording_sid),
         user_id = COALESCE($7, user_id),
         updated_at = NOW()
       WHERE call_sid = $8`,
      [status, startTime || null, endTime || null, duration ?? null, recordingUrl || null, recordingSid || null, userId || row.user_id, callSid]
    );
    return { ...row, status, updated: true };
  }

  const insertResult = await query(
    `INSERT INTO call_history (call_sid, from_number, to_number, direction, status, start_time, end_time, duration, recording_url, recording_sid, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [callSid, fromNumber, toNumber, direction, status, startTime || null, endTime || null, duration ?? null, recordingUrl || null, recordingSid || null, userId]
  );
  return insertResult.rows[0];
}

// ─── Get User Call History ──────────────────────────────────────────────────

export async function getUserCallHistory(
  userId: string,
  limit: number = 50,
  syncFromTwilio: boolean = false,
  page: number = 1,
  filters: { search?: string; direction?: string; status?: string; fromDate?: string; toDate?: string } = {},
) {
  // Get user's assigned phone numbers
  const phonesResult = await query(
    `SELECT phone_number FROM phone_assignments WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
  const phoneNumbers = phonesResult.rows.map((r: any) => r.phone_number);

  if (syncFromTwilio) {
    try {
      await syncCallHistoryFromTwilio(userId, limit);
    } catch (e: any) {
      console.warn('Twilio sync failed:', e.message);
    }
  }

  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // User's calls OR calls to/from their phone numbers
  if (phoneNumbers.length > 0) {
    conditions.push(`(ch.user_id = $${idx} OR ch.from_number = ANY($${idx + 1}) OR ch.to_number = ANY($${idx + 1}))`);
    params.push(userId, phoneNumbers);
    idx += 2;
  } else {
    conditions.push(`ch.user_id = $${idx}`);
    params.push(userId);
    idx++;
  }

  // Exclude client: identifiers
  conditions.push(`ch.from_number NOT LIKE 'client:%'`);
  conditions.push(`ch.to_number NOT LIKE 'client:%'`);

  if (filters.search) {
    conditions.push(`(ch.from_number ILIKE $${idx} OR ch.to_number ILIKE $${idx} OR ch.call_sid ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.direction) {
    conditions.push(`ch.direction ILIKE $${idx}`);
    params.push(filters.direction);
    idx++;
  }
  if (filters.status) {
    if (filters.status.toLowerCase() === 'missed') {
      conditions.push(`LOWER(ch.status) IN ('missed', 'missed call')`);
    } else {
      conditions.push(`ch.status ILIKE $${idx}`);
      params.push(filters.status);
      idx++;
    }
  }
  if (filters.fromDate) {
    conditions.push(`COALESCE(ch.start_time, ch.created_at) >= $${idx}`);
    params.push(new Date(filters.fromDate));
    idx++;
  }
  if (filters.toDate) {
    const toDate = new Date(filters.toDate);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(`COALESCE(ch.start_time, ch.created_at) <= $${idx}`);
    params.push(toDate);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) as total FROM call_history ch ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  const dataParams = [...params, safeLimit, offset];
  const dataResult = await query(
    `SELECT ch.* FROM call_history ch
     ${whereClause}
     ORDER BY COALESCE(ch.start_time, ch.created_at) DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    dataParams
  );

  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    data: dataResult.rows,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}

// ─── Sync from Twilio API ───────────────────────────────────────────────────

export async function syncCallHistoryFromTwilio(userId: string, limit: number = 50) {
  const userResult = await query(
    `SELECT twilio_account_sid, twilio_auth_token FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user?.twilio_account_sid || !user?.twilio_auth_token) {
    return { synced: 0, errors: 0 };
  }

  const phonesResult = await query(
    `SELECT phone_number FROM phone_assignments WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
  const phoneNumbers = phonesResult.rows.map((r: any) => r.phone_number);
  if (phoneNumbers.length === 0) return { synced: 0, errors: 0 };

  const credentials: TwilioCredentials = {
    accountSid: user.twilio_account_sid,
    authToken: user.twilio_auth_token,
  };
  const client = createClient(credentials);

  let synced = 0;
  let errors = 0;

  for (const phoneNumber of phoneNumbers) {
    try {
      const [outbound, inbound] = await Promise.all([
        client.calls.list({ limit, from: phoneNumber }),
        client.calls.list({ limit, to: phoneNumber }),
      ]);

      const allCalls = new Map<string, any>();
      [...outbound, ...inbound].forEach(c => { if (!allCalls.has(c.sid)) allCalls.set(c.sid, c); });

      for (const call of allCalls.values()) {
        try {
          if (call.from?.startsWith('client:') || call.to?.startsWith('client:')) continue;

          let finalStatus = call.status;
          const isInbound = call.direction?.toLowerCase() === 'inbound';

          if (call.status === 'no-answer' && isInbound) finalStatus = 'missed';
          else if (isInbound && call.status === 'completed') {
            const dur = call.duration ? parseInt(call.duration.toString(), 10) : 0;
            if (dur <= 1) finalStatus = 'missed';
          }

          // Fetch recording for completed calls
          let recordingSid: string | undefined;
          let recordingUrl: string | undefined;
          try {
            const recordings = await client.calls(call.sid).recordings.list({ limit: 1 });
            if (recordings.length > 0) {
              recordingSid = recordings[0].sid;
              recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Recordings/${recordings[0].sid}`;
            }
          } catch { /* ignore */ }

          const syncDuration = (finalStatus === 'missed' && isInbound)
            ? 0
            : (call.duration ? parseInt(call.duration.toString()) : undefined);

          await saveCallHistory({
            callSid: call.sid,
            fromNumber: call.from,
            toNumber: call.to,
            direction: call.direction,
            status: finalStatus,
            startTime: call.startTime ? new Date(call.startTime) : undefined,
            endTime: call.endTime ? new Date(call.endTime) : undefined,
            duration: syncDuration,
            recordingSid,
            recordingUrl,
            userId,
          });
          synced++;
        } catch (e: any) {
          console.warn(`Failed to save call ${call.sid}:`, e.message);
          errors++;
        }
      }
    } catch (e: any) {
      console.error(`Error syncing calls for ${phoneNumber}:`, e.message);
      errors++;
    }
  }

  return { synced, errors };
}

// ─── Save Call History Manually ─────────────────────────────────────────────

export async function saveCallHistoryManual(
  callData: { callSid: string; to: string; from: string; direction: string },
  userId: string,
) {
  const userResult = await query(
    `SELECT twilio_account_sid, twilio_auth_token FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];

  let callDetails: any = null;
  if (user?.twilio_account_sid && user?.twilio_auth_token) {
    try {
      const client = createClient({ accountSid: user.twilio_account_sid, authToken: user.twilio_auth_token });
      const cd = await client.calls(callData.callSid).fetch();
      callDetails = {
        status: cd.status,
        duration: cd.duration,
        startTime: cd.startTime,
        endTime: cd.endTime,
      };
    } catch { /* use basic info */ }
  }

  await saveCallHistory({
    callSid: callData.callSid,
    fromNumber: callData.from,
    toNumber: callData.to,
    direction: callData.direction,
    status: callDetails?.status || 'completed',
    startTime: callDetails?.startTime,
    endTime: callDetails?.endTime || new Date(),
    duration: callDetails?.duration ? parseInt(callDetails.duration) : undefined,
    userId,
  });

  return { success: true };
}

// ─── Get Twilio Call Details / Recordings ───────────────────────────────────

export async function getCallDetails(callSid: string, credentials: TwilioCredentials) {
  const client = createClient(credentials);
  const call = await client.calls(callSid).fetch();
  return {
    sid: call.sid,
    status: call.status,
    from: call.from,
    to: call.to,
    direction: call.direction,
    duration: call.duration,
    startTime: call.startTime,
    endTime: call.endTime,
    parentCallSid: call.parentCallSid,
    dateCreated: call.dateCreated,
  };
}

export async function getCallRecordings(callSid: string, credentials: TwilioCredentials) {
  const client = createClient(credentials);
  const recordings = await client.calls(callSid).recordings.list();
  return recordings.map(r => ({
    sid: r.sid,
    callSid: r.callSid,
    status: r.status,
    channels: r.channels,
    duration: r.duration,
    dateCreated: r.dateCreated,
    uri: r.uri,
  }));
}

export async function updateCallStatus(callSid: string, status: string, credentials: TwilioCredentials) {
  const client = createClient(credentials);
  const call = await client.calls(callSid).update({ status: status as any });
  return { sid: call.sid, status: call.status };
}

// ─── Get Call Recording (proxied with auth) ─────────────────────────────────

export async function getCallRecording(callSid: string, userId: string) {
  const historyResult = await query(
    `SELECT recording_url, recording_sid, user_id FROM call_history WHERE call_sid = $1 AND user_id = $2`,
    [callSid, userId]
  );
  const row = historyResult.rows[0];
  if (!row) throw new Error('Call not found or not accessible');
  if (!row.recording_url && !row.recording_sid) throw new Error('No recording available');

  const userResult = await query(
    `SELECT twilio_account_sid, twilio_auth_token FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user?.twilio_account_sid || !user?.twilio_auth_token) {
    throw new Error('Twilio credentials not found');
  }

  if (row.recording_url && !row.recording_url.includes('api.twilio.com')) {
    return { recordingUrl: row.recording_url, recordingSid: row.recording_sid };
  }

  if (row.recording_sid) {
    const encoded = `${encodeURIComponent(user.twilio_account_sid)}:${encodeURIComponent(user.twilio_auth_token)}`;
    const url = `https://${encoded}@api.twilio.com/2010-04-01/Accounts/${user.twilio_account_sid}/Recordings/${row.recording_sid}.mp3`;
    return { recordingUrl: url, recordingSid: row.recording_sid };
  }

  return { recordingUrl: row.recording_url || '', recordingSid: row.recording_sid };
}

// ─── Admin: All Recordings ──────────────────────────────────────────────────

export async function getAllCallRecordings(
  limit: number = 50,
  page: number = 1,
  filters?: { search?: string; direction?: string; status?: string; fromDate?: string; toDate?: string },
) {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  const conditions: string[] = [
    `ch.from_number NOT LIKE 'client:%'`,
    `ch.to_number NOT LIKE 'client:%'`,
  ];
  const params: unknown[] = [];
  let idx = 1;

  if (filters?.search) {
    conditions.push(`(ch.from_number ILIKE $${idx} OR ch.to_number ILIKE $${idx} OR ch.call_sid ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters?.direction) {
    if (filters.direction.toLowerCase() === 'inbound') {
      conditions.push(`ch.direction ILIKE '%inbound%'`);
    } else {
      conditions.push(`ch.direction NOT ILIKE '%inbound%'`);
    }
  }
  if (filters?.status) {
    conditions.push(`LOWER(ch.status) = $${idx}`);
    params.push(filters.status.toLowerCase());
    idx++;
  }
  if (filters?.fromDate) {
    conditions.push(`ch.created_at >= $${idx}`);
    params.push(new Date(filters.fromDate));
    idx++;
  }
  if (filters?.toDate) {
    const toDate = new Date(filters.toDate);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(`ch.created_at <= $${idx}`);
    params.push(toDate);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*) as total FROM call_history ch ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataParams = [...params, safeLimit, offset];
  const dataResult = await query(
    `SELECT ch.*, u.first_name, u.last_name, u.email
     FROM call_history ch
     LEFT JOIN users u ON ch.user_id = u.id
     ${whereClause}
     ORDER BY COALESCE(ch.start_time, ch.created_at) DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    dataParams
  );

  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  return { data: dataResult.rows, page: safePage, limit: safeLimit, total, totalPages };
}

// ─── Admin Recording Fetch ──────────────────────────────────────────────────

export async function getCallRecordingAdmin(callSid: string) {
  const historyResult = await query(
    `SELECT recording_url, recording_sid, user_id FROM call_history WHERE call_sid = $1`,
    [callSid]
  );
  const row = historyResult.rows[0];
  if (!row) throw new Error('Call not found');
  if (!row.recording_url && !row.recording_sid) throw new Error('No recording available');

  const userResult = await query(
    `SELECT twilio_account_sid, twilio_auth_token FROM users WHERE id = $1`,
    [row.user_id]
  );
  const user = userResult.rows[0];
  if (!user?.twilio_account_sid || !user?.twilio_auth_token) {
    throw new Error('Twilio credentials not found for call owner');
  }

  if (row.recording_url && !row.recording_url.includes('api.twilio.com')) {
    return { recordingUrl: row.recording_url, recordingSid: row.recording_sid };
  }

  if (row.recording_sid) {
    const encoded = `${encodeURIComponent(user.twilio_account_sid)}:${encodeURIComponent(user.twilio_auth_token)}`;
    const url = `https://${encoded}@api.twilio.com/2010-04-01/Accounts/${user.twilio_account_sid}/Recordings/${row.recording_sid}.mp3`;
    return { recordingUrl: url, recordingSid: row.recording_sid };
  }

  return { recordingUrl: row.recording_url || '', recordingSid: row.recording_sid };
}

// ─── TwiML Generation ───────────────────────────────────────────────────────

export async function generateVoiceTwiML(body: any): Promise<string> {
  const baseUrl = env.API_BASE_URL;
  const toParam = body?.To || body?.to;
  const fromParam = body?.From || body?.from;

  try {
    const twilioNumber = await checkTwilioNumber(fromParam, toParam);
    if (!twilioNumber) throw new Error('Twilio number not identified');

    if (toParam === twilioNumber) {
      return handleInboundCall(twilioNumber, fromParam, baseUrl);
    } else {
      return handleOutboundCall(toParam, fromParam, baseUrl);
    }
  } catch (e: any) {
    console.error('TwiML generation error:', e.message);
    return errorTwiML();
  }
}

async function checkTwilioNumber(from: string, to: string): Promise<string | null> {
  const fromResult = await query(
    `SELECT phone_number FROM phone_assignments WHERE phone_number = $1 AND is_active = true LIMIT 1`,
    [from]
  );
  if (fromResult.rows.length > 0) return from;

  const toResult = await query(
    `SELECT phone_number FROM phone_assignments WHERE phone_number = $1 AND is_active = true LIMIT 1`,
    [to]
  );
  if (toResult.rows.length > 0) return to;

  return null;
}

async function handleInboundCall(twilioNumber: string, callerNumber: string, baseUrl: string): Promise<string> {
  const assignResult = await query(
    `SELECT pa.*, u.first_name, u.last_name, u.email, u.phone
     FROM phone_assignments pa
     LEFT JOIN users u ON pa.user_id = u.id
     WHERE pa.phone_number = $1 AND pa.is_active = true
     LIMIT 1`,
    [twilioNumber]
  );

  const assignment = assignResult.rows[0];
  if (!assignment?.user_id) return errorTwiML();

  const conferenceName = `call-inbound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  setActiveCall(assignment.user_id, conferenceName, '', callerNumber);

  if (assignment.signed_in_forward && assignment.forward_number) {
    const forwardNumber = formatE164(assignment.forward_number);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer" recordingStatusCallback="${baseUrl}/webhooks/voice/recording">
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.none">${conferenceName}</Conference>
  </Dial>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer" recordingStatusCallback="${baseUrl}/webhooks/voice/recording">
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.none">${conferenceName}</Conference>
  </Dial>
</Response>`;
}

async function handleOutboundCall(toNumber: string, fromNumber: string, baseUrl: string): Promise<string> {
  const conferenceName = `call-outbound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const assignResult = await query(
    `SELECT user_id FROM phone_assignments WHERE phone_number = $1 AND is_active = true LIMIT 1`,
    [fromNumber]
  );
  if (assignResult.rows[0]?.user_id) {
    setActiveCall(assignResult.rows[0].user_id, conferenceName, '', toNumber);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${fromNumber}" timeout="30" record="record-from-answer" recordingStatusCallback="${baseUrl}/webhooks/voice/recording">
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.none">${conferenceName}</Conference>
  </Dial>
</Response>`;
}

function errorTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We are unable to take your call right now. Please try again later.</Say>
  <Hangup/>
</Response>`;
}

// ─── Voice Status Callback Handler ──────────────────────────────────────────

export async function handleVoiceStatusCallback(callbackData: any) {
  try {
    const {
      CallSid, From, To, CallStatus, Direction, Duration,
      StartTime, EndTime, Called, Caller, FromFormatted, ToFormatted,
    } = callbackData;

    let durationInSeconds: number | undefined;
    if (Duration) {
      const parsed = parseInt(typeof Duration === 'string' ? Duration : String(Duration), 10);
      if (!isNaN(parsed)) durationInSeconds = parsed;
    }

    let startTimeDate: Date | undefined;
    let endTimeDate: Date | undefined;
    if (StartTime) { const d = new Date(StartTime); if (!isNaN(d.getTime())) startTimeDate = d; }
    if (EndTime) { const d = new Date(EndTime); if (!isNaN(d.getTime())) endTimeDate = d; }

    // Resolve best phone numbers from webhook fields
    let fromNumber = From;
    let toNumber = To;

    if (From?.startsWith('client:')) {
      if (Caller && !Caller.startsWith('client:')) fromNumber = Caller;
      else if (FromFormatted && !FromFormatted.startsWith('client:')) fromNumber = FromFormatted;
    }
    if (!toNumber || toNumber.startsWith('client:')) {
      if (Called && !Called.startsWith('client:') && Called.trim()) toNumber = Called;
      else if (ToFormatted && !ToFormatted.startsWith('client:') && ToFormatted.trim()) toNumber = ToFormatted;
    }

    const finalToNumber = toNumber || To;
    const finalFromNumber = fromNumber || From;

    // Skip outgoing-dial-to-client legs (internal Voice SDK connections)
    const dirLower = Direction?.toLowerCase() || '';
    const isOutboundDial = ['outbound', 'outbound-api', 'outbound-dial'].includes(dirLower);
    if (isOutboundDial && finalToNumber?.startsWith('client:')) {
      // Propagate status to the related inbound call
      if (startTimeDate) {
        const window10s = 10000;
        const relatedResult = await query(
          `SELECT * FROM call_history
           WHERE direction IN ('inbound', 'incoming')
             AND start_time BETWEEN $1 AND $2
             AND (from_number = $3 OR from_number LIKE $4)
             AND to_number NOT LIKE 'client:%'
           ORDER BY start_time DESC LIMIT 1`,
          [
            new Date(startTimeDate.getTime() - window10s),
            new Date(startTimeDate.getTime() + window10s),
            finalFromNumber,
            `%${normalizePhone(finalFromNumber).slice(-10)}%`,
          ]
        );
        if (relatedResult.rows.length > 0) {
          const related = relatedResult.rows[0];
          let incomingStatus = CallStatus?.toLowerCase() || 'completed';
          const childDuration = typeof durationInSeconds === 'number' ? durationInSeconds : 0;

          if (['no-answer', 'failed', 'canceled'].includes(incomingStatus)) incomingStatus = 'missed';
          else if (incomingStatus === 'completed' && childDuration <= 1) incomingStatus = 'missed';

          await query(
            `UPDATE call_history SET status = $1, duration = $2, end_time = COALESCE($3, end_time), updated_at = NOW() WHERE call_sid = $4`,
            [incomingStatus, incomingStatus === 'missed' ? 0 : (durationInSeconds ?? related.duration), endTimeDate || null, related.call_sid]
          );
        }
      }
      return; // skip saving the dial-to-client leg itself
    }

    // Skip calls from client: identifiers
    if (finalFromNumber?.startsWith('client:')) return;

    // Determine direction by checking phone assignments
    let finalDirection = Direction;
    if (isOutboundDial) {
      const userPhones = await query(
        `SELECT phone_number FROM phone_assignments WHERE is_active = true`,
        []
      );
      const phones = userPhones.rows.map((r: any) => normalizePhone(r.phone_number));
      const normTo = normalizePhone(finalToNumber);
      const normFrom = normalizePhone(finalFromNumber);
      const matchesTo = phones.some(p => p.slice(-10) === normTo.slice(-10));
      const matchesFrom = phones.some(p => p.slice(-10) === normFrom.slice(-10));

      if (matchesTo && !matchesFrom) finalDirection = 'inbound';
      else if (matchesFrom && !matchesTo) finalDirection = 'outbound-api';
    }

    // Determine final status
    let finalStatus = CallStatus;
    const isInbound = finalDirection?.toLowerCase().includes('inbound');

    if (CallStatus?.toLowerCase() === 'no-answer' && isInbound) finalStatus = 'missed';
    else if (isInbound && CallStatus?.toLowerCase() === 'completed') {
      const dur = typeof durationInSeconds === 'number' ? durationInSeconds : 0;
      if (dur <= 1) finalStatus = 'missed';
    }

    // Fetch recording for completed calls
    let recordingSid: string | undefined;
    let recordingUrl: string | undefined;
    if (finalStatus === 'completed' && callbackData.AccountSid) {
      try {
        const userResult = await query(
          `SELECT twilio_account_sid, twilio_auth_token FROM users WHERE twilio_account_sid = $1 LIMIT 1`,
          [callbackData.AccountSid]
        );
        const user = userResult.rows[0];
        if (user) {
          const client = createClient({ accountSid: user.twilio_account_sid, authToken: user.twilio_auth_token });
          const recordings = await client.calls(CallSid).recordings.list({ limit: 1 });
          if (recordings.length > 0) {
            recordingSid = recordings[0].sid;
            recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${user.twilio_account_sid}/Recordings/${recordings[0].sid}`;
          }
        }
      } catch { /* ignore */ }
    }

    await saveCallHistory({
      callSid: CallSid,
      fromNumber: finalFromNumber,
      toNumber: finalToNumber,
      direction: finalDirection,
      status: finalStatus,
      startTime: startTimeDate,
      endTime: endTimeDate,
      duration: durationInSeconds,
      recordingSid,
      recordingUrl,
    });
  } catch (e: any) {
    console.error('Voice status callback error:', e.message);
  }
}

// ─── Recording Callback Handler ─────────────────────────────────────────────

export async function handleRecordingCallback(data: any) {
  try {
    const { CallSid, RecordingSid, RecordingUrl } = data;
    await query(
      `UPDATE call_history SET recording_url = $1, recording_sid = $2, updated_at = NOW() WHERE call_sid = $3`,
      [RecordingUrl, RecordingSid, CallSid]
    );
  } catch (e: any) {
    console.error('Recording callback error:', e.message);
  }
}

// ─── Dialer Settings ────────────────────────────────────────────────────────

export async function getDialerSettings(userId: string) {
  const result = await query(
    `SELECT * FROM dialer_routing_settings WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length > 0) return result.rows[0];

  // Create defaults
  const insertResult = await query(
    `INSERT INTO dialer_routing_settings (user_id) VALUES ($1) RETURNING *`,
    [userId]
  );
  return insertResult.rows[0];
}

export async function updateDialerSettings(userId: string, dto: Record<string, any>) {
  const allowed = [
    'max_attempts', 'retry_interval', 'auto_requeue', 'call_order',
    'local_presence', 'between_call_delay', 'local_presence_default',
    'auto_dial_default', 'audio_input_device_id', 'audio_output_device_id',
  ];

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    // Accept both snake_case and camelCase from the client
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const value = dto[key] ?? dto[camel];
    if (value !== undefined) {
      setClauses.push(`${key} = $${idx}`);
      params.push(value);
      idx++;
    }
  }

  if (setClauses.length === 0) return getDialerSettings(userId);

  setClauses.push('updated_at = NOW()');
  params.push(userId);

  const result = await query(
    `INSERT INTO dialer_routing_settings (user_id)
     VALUES ($${idx})
     ON CONFLICT (user_id) DO UPDATE SET ${setClauses.join(', ')}
     RETURNING *`,
    params
  );
  return result.rows[0];
}

// ─── Phone Assignments ──────────────────────────────────────────────────────

export async function getPhoneAssignments(userId: string) {
  const result = await query(
    `SELECT * FROM phone_assignments WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function createPhoneAssignment(data: {
  phoneNumber: string;
  accountSid: string;
  provider?: string;
  friendlyName?: string;
  numberType?: string;
  userId?: string;
}) {
  const result = await query(
    `INSERT INTO phone_assignments (phone_number, account_sid, provider, friendly_name, number_type, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.phoneNumber, data.accountSid, data.provider || 'twilio', data.friendlyName || null, data.numberType || null, data.userId || null]
  );
  return result.rows[0];
}

export async function updatePhoneAssignment(id: string, data: { forwardNumber?: string; signedInForward?: boolean }) {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.forwardNumber !== undefined) {
    setClauses.push(`forward_number = $${idx++}`);
    params.push(data.forwardNumber || null);
  }
  if (data.signedInForward !== undefined) {
    setClauses.push(`signed_in_forward = $${idx++}`);
    params.push(data.signedInForward);
  }
  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = NOW()');
  params.push(id);

  const result = await query(
    `UPDATE phone_assignments SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function deletePhoneAssignment(id: string) {
  await query(`UPDATE phone_assignments SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
  return { success: true };
}

// ─── Conference TwiML ───────────────────────────────────────────────────────

export function generateConferenceTwiML(conferenceName: string) {
  const baseUrl = env.API_BASE_URL;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="30" record="record-from-answer" recordingStatusCallback="${baseUrl}/webhooks/voice/recording">
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.none">${conferenceName}</Conference>
  </Dial>
</Response>`;
}
