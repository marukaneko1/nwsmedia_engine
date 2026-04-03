import { Request, Response, NextFunction } from 'express';

function stripTags(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '');
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let clean = value.trim();
    clean = stripTags(clean);
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    return clean;
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') return sanitizeObject(value as Record<string, unknown>);
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'password' || key === 'password_hash') {
      cleaned[key] = val;
      continue;
    }
    cleaned[key] = sanitizeValue(val);
  }
  return cleaned;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = sanitizeValue(val) as string;
      }
    }
  }
  next();
}
