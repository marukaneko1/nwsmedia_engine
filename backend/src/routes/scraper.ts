import { Router, Request, Response } from 'express';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);
router.use(requireRole('admin'));

const ALLOWED_COMMANDS = new Set([
  'scrape',
  'scrape-batch',
  'scrape-craigslist',
  'scrape-craigslist-batch',
  'scrape-yelp',
  'scrape-yelp-batch',
  'yelp-pipeline',
  'import-filings',
  'enrich-filings',
  'pipeline',
  'triage',
  'audit',
  'score',
  'enrich',
  'backfill-emails',
  'generate-pdfs',
  'rescore',
  'dedup',
]);

const stripAnsi = (text: string) => text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

let activeProc: ChildProcess | undefined;

function getProjectRoot(): string {
  if (process.env.ENGINE_ROOT) return path.resolve(process.env.ENGINE_ROOT);

  // Walk up from __dirname until we find run.py
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'run.py'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback: assume standard monorepo layout (backend/src/routes -> root)
  const backendDir = path.resolve(__dirname, '..', '..');
  return path.resolve(backendDir, '..');
}

function getPythonPath(projectRoot: string): string {
  const isWin = process.platform === 'win32';
  const rel = isWin
    ? path.join('.venv', 'Scripts', 'python.exe')
    : path.join('.venv', 'bin', 'python');
  const venvPath = path.join(projectRoot, rel);
  if (existsSync(venvPath)) return venvPath;

  // Fallback to system python
  return isWin ? 'python' : 'python3';
}

function readEnvFromRoot(projectRoot: string, key: string): string | undefined {
  const envPath = path.join(projectRoot, '.env');
  if (!existsSync(envPath)) return undefined;
  try {
    const content = readFileSync(envPath, 'utf-8');
    const line = content
      .split(/\r?\n/)
      .find((l) => l.startsWith(key + '=') && !l.trimStart().startsWith('#'));
    if (!line) return undefined;
    const raw = line.slice(key.length + 1).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1).replace(/\\"/g, '"');
    if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/\\'/g, "'");
    return raw;
  } catch {
    return undefined;
  }
}

function buildChildEnv(projectRoot: string): NodeJS.ProcessEnv {
  const inherited: Record<string, string | undefined> = { ...process.env };
  const exclude = [
    'SUPABASE_ANON_KEY',
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD',
    'SENDER_NAME',
    'SENDER_COMPANY',
    'SENDER_PHONE',
  ];
  for (const key of exclude) delete inherited[key];
  for (const key of Object.keys(inherited)) {
    if (key.startsWith('NEXT_PUBLIC_')) delete inherited[key];
  }
  let dbUrl =
    inherited.DATABASE_URL ??
    process.env.DATABASE_URL ??
    readEnvFromRoot(projectRoot, 'DATABASE_URL');
  if (dbUrl && dbUrl.startsWith('postgresql://') && !dbUrl.includes('+asyncpg')) {
    dbUrl = dbUrl.replace('postgresql://', 'postgresql+asyncpg://');
  }
  if (dbUrl) inherited.DATABASE_URL = dbUrl;
  return {
    ...inherited,
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    NO_COLOR: '1',
    TERM: 'dumb',
    COLUMNS: '120',
  };
}

function sendSSE(res: Response, type: string, payload: Record<string, unknown>) {
  try {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  } catch {
    // stream may be closed
  }
}

function runProcess(
  projectRoot: string,
  pythonPath: string,
  runScript: string,
  command: string,
  args: string[],
  res: Response
): Promise<number> {
  const env = buildChildEnv(projectRoot);
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, ['-u', runScript, command, ...args], {
      cwd: projectRoot,
      env,
    });
    activeProc = proc;

    proc.stdout?.on('data', (chunk: Buffer) => {
      sendSSE(res, 'stdout', { text: stripAnsi(chunk.toString()) });
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      sendSSE(res, 'stderr', { text: stripAnsi(chunk.toString()) });
    });
    proc.on('close', (code, signal) => {
      if (activeProc?.pid === proc.pid) activeProc = undefined;
      resolve(code ?? (signal ? 1 : 0));
    });
    proc.on('error', (err) => {
      if (activeProc?.pid === proc.pid) activeProc = undefined;
      reject(err);
    });
  });
}

// POST /api/scraper/run -- Spawn scraper process, stream SSE
router.post('/run', async (req: Request, res: Response) => {
  const { command, args } = req.body || {};

  const isAuto = command === 'auto';
  if (!ALLOWED_COMMANDS.has(command) && !isAuto) {
    res.status(400).json({ error: `Unknown command: ${command}` });
    return;
  }

  if (activeProc && !activeProc.killed) {
    activeProc.kill('SIGTERM');
    activeProc = undefined;
  }

  const projectRoot = getProjectRoot();
  const pythonPath = getPythonPath(projectRoot);
  const runScript = path.join(projectRoot, 'run.py');

  if (!existsSync(runScript)) {
    res.status(400).json({ error: `run.py not found at ${runScript}. Set ENGINE_ROOT env var to the directory containing run.py.` });
    return;
  }

  const sanitized = (args ?? []).map((a: unknown) => String(a));

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let closed = false;
  req.on('close', () => {
    closed = true;
    if (activeProc && !activeProc.killed) {
      activeProc.kill('SIGTERM');
    }
    activeProc = undefined;
  });

  try {
    if (isAuto) {
      const dryRun = sanitized.includes('--dry-run');
      const steps = dryRun ? ['scrape-batch'] : ['scrape-batch', 'pipeline'];
      sendSSE(res, 'start', { command: 'auto', steps });

      sendSSE(res, 'step', { step: 1, total: steps.length, command: 'scrape-batch' });
      const batchCode = await runProcess(projectRoot, pythonPath, runScript, 'scrape-batch', sanitized, res);

      if (closed) { res.end(); return; }
      if (batchCode !== 0) {
        sendSSE(res, 'exit', { code: batchCode });
        res.end();
        return;
      }
      if (dryRun) {
        sendSSE(res, 'exit', { code: 0 });
        res.end();
        return;
      }

      sendSSE(res, 'step', { step: 2, total: steps.length, command: 'pipeline' });
      const pipelineCode = await runProcess(projectRoot, pythonPath, runScript, 'pipeline', [], res);

      if (closed) { res.end(); return; }
      sendSSE(res, 'exit', { code: pipelineCode });
      res.end();
      return;
    }

    const proc = spawn(pythonPath, ['-u', runScript, command, ...sanitized], {
      cwd: projectRoot,
      env: buildChildEnv(projectRoot),
    });
    activeProc = proc;

    sendSSE(res, 'start', { command, args: sanitized, pid: proc.pid });

    proc.stdout?.on('data', (chunk: Buffer) => {
      if (!closed) sendSSE(res, 'stdout', { text: stripAnsi(chunk.toString()) });
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      if (!closed) sendSSE(res, 'stderr', { text: stripAnsi(chunk.toString()) });
    });
    proc.on('close', (code) => {
      if (activeProc?.pid === proc.pid) activeProc = undefined;
      if (!closed) {
        sendSSE(res, 'exit', { code: code ?? 0 });
        res.end();
      }
    });
    proc.on('error', (err) => {
      if (activeProc?.pid === proc.pid) activeProc = undefined;
      if (!closed) {
        sendSSE(res, 'error', { message: err.message });
        res.end();
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendSSE(res, 'error', { message });
    res.end();
  }
});

// DELETE /api/scraper/run -- Kill active scraper process
router.delete('/run', (_req: Request, res: Response) => {
  if (activeProc && !activeProc.killed) {
    activeProc.kill('SIGTERM');
    activeProc = undefined;
    res.json({ ok: true, message: 'Process terminated' });
    return;
  }
  res.json({ ok: true, message: 'No active process' });
});

export default router;
