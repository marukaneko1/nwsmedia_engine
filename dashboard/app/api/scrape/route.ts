import { type ChildProcess, spawn } from "child_process";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { invalidateCache } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resolve repo root (where run.py and .venv live). Next dev often runs with cwd = workspace root. */
function getProjectRoot(): string {
  const cwd = process.cwd();
  const fromDashboard = path.basename(cwd) === "dashboard";
  return fromDashboard ? path.resolve(cwd, "..") : cwd;
}

/** Cross-platform path to venv Python (Windows: Scripts/python.exe, Unix: bin/python). */
function getPythonPath(projectRoot: string): string {
  const isWin = process.platform === "win32";
  const rel = isWin
    ? path.join(".venv", "Scripts", "python.exe")
    : path.join(".venv", "bin", "python");
  return path.join(projectRoot, rel);
}

const ALLOWED_COMMANDS = new Set([
  "scrape",
  "scrape-batch",
  "pipeline",
  "triage",
  "audit",
  "score",
  "enrich",
  "backfill-emails",
  "generate-pdfs",
  "rescore",
  "dedup",
]);

const stripAnsi = (text: string) =>
  text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

const g = globalThis as unknown as { __scrapeProc?: ChildProcess };

/** Parse KEY=VALUE from repo root .env; return value for KEY or undefined. */
function readEnvFromRoot(projectRoot: string, key: string): string | undefined {
  const envPath = path.join(projectRoot, ".env");
  if (!existsSync(envPath)) return undefined;
  try {
    const content = readFileSync(envPath, "utf-8");
    const line = content
      .split(/\r?\n/)
      .find((l) => l.startsWith(key + "=") && !l.trimStart().startsWith("#"));
    if (!line) return undefined;
    const raw = line.slice(key.length + 1).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1).replace(/\\"/g, '"');
    if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/\\'/g, "'");
    return raw;
  } catch {
    return undefined;
  }
}

function buildChildEnv(projectRoot: string) {
  const inherited = { ...process.env };
  const exclude = [
    "SUPABASE_ANON_KEY",
    "GMAIL_USER",
    "GMAIL_APP_PASSWORD",
    "SENDER_NAME",
    "SENDER_COMPANY",
    "SENDER_PHONE",
  ];
  for (const key of exclude) delete inherited[key];
  for (const key of Object.keys(inherited)) {
    if (key.startsWith("NEXT_PUBLIC_")) delete inherited[key];
  }
  // Ensure Python uses same DB as repo root .env (dashboard may not have DATABASE_URL)
  let dbUrl = inherited.DATABASE_URL ?? process.env.DATABASE_URL ?? readEnvFromRoot(projectRoot, "DATABASE_URL");
  if (dbUrl && dbUrl.startsWith("postgresql://") && !dbUrl.includes("+asyncpg")) {
    dbUrl = dbUrl.replace("postgresql://", "postgresql+asyncpg://", 1);
  }
  if (dbUrl) inherited.DATABASE_URL = dbUrl;
  return {
    ...inherited,
    PYTHONUNBUFFERED: "1",
    PYTHONIOENCODING: "utf-8",
    NO_COLOR: "1",
    TERM: "dumb",
    COLUMNS: "120",
  };
}

function runProcess(
  projectRoot: string,
  pythonPath: string,
  runScript: string,
  command: string,
  args: string[],
  send: (type: string, payload: Record<string, unknown>) => void
): Promise<number> {
  const env = buildChildEnv(projectRoot);
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, ["-u", runScript, command, ...args], {
      cwd: projectRoot,
      env,
    });
    g.__scrapeProc = proc;

    proc.stdout?.on("data", (chunk: Buffer) => {
      send("stdout", { text: stripAnsi(chunk.toString()) });
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      send("stderr", { text: stripAnsi(chunk.toString()) });
    });
    proc.on("close", (code, signal) => {
      if (g.__scrapeProc?.pid === proc.pid) g.__scrapeProc = undefined;
      resolve(code ?? (signal ? 1 : 0));
    });
    proc.on("error", (err) => {
      if (g.__scrapeProc?.pid === proc.pid) g.__scrapeProc = undefined;
      reject(err);
    });
  });
}

export async function POST(request: Request) {
  let body: { command: string; args: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { command, args } = body;

  const isAuto = command === "auto";
  if (!ALLOWED_COMMANDS.has(command) && !isAuto) {
    return Response.json({ error: `Unknown command: ${command}` }, { status: 400 });
  }

  if (g.__scrapeProc && !g.__scrapeProc.killed) {
    g.__scrapeProc.kill("SIGTERM");
    g.__scrapeProc = undefined;
  }

  const projectRoot = getProjectRoot();
  const pythonPath = getPythonPath(projectRoot);
  const runScript = path.join(projectRoot, "run.py");

  if (!existsSync(runScript)) {
    return Response.json(
      { error: `run.py not found at ${runScript}. Run the scraper from the repo root or dashboard.` },
      { status: 400 }
    );
  }
  if (!existsSync(pythonPath)) {
    return Response.json(
      { error: `Python not found at ${pythonPath}. Create a venv: python -m venv .venv` },
      { status: 400 }
    );
  }

  const sanitized = (args ?? []).map((a) => String(a));

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: Record<string, unknown>) => {
        if (cancelled) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, ...payload })}\n\n`)
          );
        } catch {
          /* stream may already be closed */
        }
      };

      try {
        if (isAuto) {
          const dryRun = sanitized.includes("--dry-run");
          const steps = dryRun ? ["scrape-batch"] : ["scrape-batch", "pipeline"];
          const totalSteps = steps.length;
          send("start", { command: "auto", steps });

          send("step", { step: 1, total: totalSteps, command: "scrape-batch" });
          const batchCode = await runProcess(
            projectRoot,
            pythonPath,
            runScript,
            "scrape-batch",
            sanitized,
            send
          );

          if (cancelled) {
            controller.close();
            return;
          }
          if (batchCode !== 0) {
            send("exit", { code: batchCode });
            controller.close();
            return;
          }

          if (dryRun) {
            send("exit", { code: 0 });
            controller.close();
            return;
          }

          send("step", { step: 2, total: totalSteps, command: "pipeline" });
          const pipelineCode = await runProcess(
            projectRoot,
            pythonPath,
            runScript,
            "pipeline",
            [],
            send
          );

          if (cancelled) {
            controller.close();
            return;
          }
          invalidateCache();
          send("exit", { code: pipelineCode });
          controller.close();
          return;
        }

        const proc = spawn(pythonPath, ["-u", runScript, command, ...sanitized], {
          cwd: projectRoot,
          env: buildChildEnv(projectRoot),
        });
        g.__scrapeProc = proc;

        send("start", { command, args: sanitized, pid: proc.pid });

        proc.stdout?.on("data", (chunk: Buffer) => {
          send("stdout", { text: stripAnsi(chunk.toString()) });
        });
        proc.stderr?.on("data", (chunk: Buffer) => {
          send("stderr", { text: stripAnsi(chunk.toString()) });
        });
        proc.on("close", (code) => {
          if (g.__scrapeProc?.pid === proc.pid) g.__scrapeProc = undefined;
          invalidateCache();
          send("exit", { code: code ?? 0 });
          controller.close();
        });
        proc.on("error", (err) => {
          if (g.__scrapeProc?.pid === proc.pid) g.__scrapeProc = undefined;
          send("error", { message: err.message });
          controller.close();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send("error", { message });
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
      if (g.__scrapeProc && !g.__scrapeProc.killed) {
        g.__scrapeProc.kill("SIGTERM");
      }
      g.__scrapeProc = undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE() {
  if (g.__scrapeProc && !g.__scrapeProc.killed) {
    g.__scrapeProc.kill("SIGTERM");
    g.__scrapeProc = undefined;
    return Response.json({ ok: true, message: "Process terminated" });
  }
  return Response.json({ ok: true, message: "No active process" });
}
