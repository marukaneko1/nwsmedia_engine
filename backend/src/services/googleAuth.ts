import crypto from 'crypto';
import { env } from '../config/env';
import { query } from '../config/database';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encrypted] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function getOAuth2Client() {
  const { google } = require('googleapis');
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.API_URL}/api/google/callback`
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function getAuthUrl(userId: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: userId,
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiry: Date | null,
  scopes: string[],
  googleEmail: string
) {
  const encAccess = encrypt(accessToken);
  const encRefresh = encrypt(refreshToken);

  await query(
    `INSERT INTO google_tokens (user_id, access_token, refresh_token, token_expiry, scopes, google_email)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = $2, refresh_token = $3, token_expiry = $4,
       scopes = $5, google_email = $6, updated_at = NOW()`,
    [userId, encAccess, encRefresh, expiry, scopes, googleEmail]
  );
}

export async function getAuthenticatedClient(userId: string) {
  const result = await query(
    `SELECT access_token, refresh_token, token_expiry FROM google_tokens WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const accessToken = decrypt(row.access_token);
  const refreshToken = decrypt(row.refresh_token);

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : undefined,
  });

  client.on('tokens', async (tokens: any) => {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (tokens.access_token) {
      updates.push(`access_token = $${idx++}`);
      params.push(encrypt(tokens.access_token));
    }
    if (tokens.expiry_date) {
      updates.push(`token_expiry = $${idx++}`);
      params.push(new Date(tokens.expiry_date));
    }
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(userId);
      await query(
        `UPDATE google_tokens SET ${updates.join(', ')} WHERE user_id = $${idx}`,
        params
      );
    }
  });

  return client;
}

export async function removeTokens(userId: string) {
  await query(`DELETE FROM google_tokens WHERE user_id = $1`, [userId]);
}

export async function hasGoogleTokens(userId: string) {
  const result = await query(
    `SELECT google_email FROM google_tokens WHERE user_id = $1`,
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}
