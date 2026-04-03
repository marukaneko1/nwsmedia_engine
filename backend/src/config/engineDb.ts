import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const engineUrl = process.env.ENGINE_DATABASE_URL;

const enginePool = engineUrl
  ? new Pool({
      connectionString: engineUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

if (enginePool) {
  enginePool.on('error', (err) => {
    console.error('Engine database pool error:', err);
  });
}

export function isEngineDbConfigured(): boolean {
  return enginePool !== null;
}

export async function engineQuery(text: string, params?: unknown[]): Promise<QueryResult> {
  if (!enginePool) {
    throw new Error('ENGINE_DATABASE_URL is not configured');
  }
  const start = Date.now();
  const result = await enginePool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`Slow engine query (${duration}ms):`, text.slice(0, 100));
  }
  return result;
}

export default enginePool;
