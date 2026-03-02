import { type ChildProcess, spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
]);

const stripAnsi = (text: string) =>
  text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

const g = globalThis as unknown as { __scrapeProc?: ChildProcess };

function buildChildEnv() {
  const inherited = { ...process.env };
  const exclude = [
    "DATABASE_URL",
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
  return {
    ...inherited,
    PYTHONUNBUFFERED: "1",
    NO_COLOR: "1",
    TERM: "dumb",
    COLUMNS: "120",
  };
}

const env = buildChildEnv();

function runProcess(
  projectRoot: string,
  pythonPath: string,
  runScript: string,
  command: string,
  args: string[],
  send: (type: string, payload: Record<string, unknown>) => void
): Promise<number> {
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
  const body = await request.json();
  const { command, args } = body as { command: string; args: string[] };

  const isAuto = command === "auto";
  if (!ALLOWED_COMMANDS.has(command) && !isAuto) {
    return Response.json({ error: `Unknown command: ${command}` }, { status: 400 });
  }

  if (g.__scrapeProc && !g.__scrapeProc.killed) {
    g.__scrapeProc.kill("SIGTERM");
    g.__scrapeProc = undefined;
  }

  const projectRoot = path.resolve(process.cwd(), "..");
  const pythonPath = path.join(projectRoot, ".venv", "bin", "python");
  const runScript = path.join(projectRoot, "run.py");

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
        send("exit", { code: pipelineCode });
        controller.close();
        return;
      }

      const proc = spawn(pythonPath, ["-u", runScript, command, ...sanitized], {
        cwd: projectRoot,
        env,
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
        send("exit", { code: code ?? 0 });
        controller.close();
      });
      proc.on("error", (err) => {
        if (g.__scrapeProc?.pid === proc.pid) g.__scrapeProc = undefined;
        send("error", { message: err.message });
        controller.close();
      });
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
