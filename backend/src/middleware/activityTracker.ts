import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { lookupGeo, parseUserAgent } from '../services/geoip';

const SKIP_PATTERNS = [
  /^\/health$/,
  /^\/uploads\//,
  /^\/api\/user-activities/,
  /^\/socket\.io/,
  /^\/api\/chat\/online$/,
];

function classifyAction(method: string, path: string): string {
  if (/\/auth\/login/i.test(path)) return 'login';
  if (/\/auth\/logout/i.test(path)) return 'logout';
  if (/\/auth\/register/i.test(path)) return 'register';
  if (method === 'GET' && /\/api\/search/i.test(path)) return 'search';
  if (method === 'GET') return 'view';
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'other';
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

export function activityTracker(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATTERNS.some((p) => p.test(req.path))) {
    next();
    return;
  }

  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const startTime = Date.now();

  res.on('finish', () => {
    const userId = req.user?.userId ?? null;
    if (!userId) return; // only track authenticated users

    const ip = extractIp(req);
    const ua = (req.headers['user-agent'] as string) || '';
    const { deviceType, browser, os } = parseUserAgent(ua);
    const action = classifyAction(req.method, req.path);
    const responseTime = Date.now() - startTime;

    setImmediate(async () => {
      try {
        const geo = await lookupGeo(ip);
        await query(
          `INSERT INTO user_activity_log
            (user_id, action, method, endpoint, ip_address, city, region, country, country_code,
             latitude, longitude, user_agent, device_type, browser, os, status_code, response_time_ms, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            userId,
            action,
            req.method,
            req.path,
            ip,
            geo.city,
            geo.region,
            geo.country,
            geo.countryCode,
            geo.latitude,
            geo.longitude,
            ua,
            deviceType,
            browser,
            os,
            res.statusCode,
            responseTime,
            JSON.stringify({ query: req.method === 'GET' ? req.query : undefined }),
          ]
        );
      } catch (err) {
        console.error('Activity tracking error:', err);
      }
    });
  });

  next();
}
