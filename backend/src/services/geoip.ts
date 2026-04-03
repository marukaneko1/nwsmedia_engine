import https from 'https';
import http from 'http';

interface GeoData {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

const cache = new Map<string, { data: GeoData; expires: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^0\.0\.0\.0$/,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

export async function lookupGeo(ip: string): Promise<GeoData> {
  const empty: GeoData = { city: null, region: null, country: null, countryCode: null, latitude: null, longitude: null };

  if (!ip || isPrivateIp(ip)) return empty;

  const cached = cache.get(ip);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const raw = await httpGet(`http://ip-api.com/json/${ip}?fields=city,regionName,country,countryCode,lat,lon,status`);
    const json = JSON.parse(raw);
    if (json.status === 'success') {
      const data: GeoData = {
        city: json.city || null,
        region: json.regionName || null,
        country: json.country || null,
        countryCode: json.countryCode || null,
        latitude: json.lat ?? null,
        longitude: json.lon ?? null,
      };
      cache.set(ip, { data, expires: Date.now() + CACHE_TTL_MS });
      return data;
    }
  } catch {
    // geo lookup is best-effort
  }

  return empty;
}

export function parseUserAgent(ua: string): { deviceType: string; browser: string; os: string } {
  let deviceType = 'Desktop';
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) deviceType = /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Mobile';

  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  let os = 'Unknown';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  return { deviceType, browser, os };
}
