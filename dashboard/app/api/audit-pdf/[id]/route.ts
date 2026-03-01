import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { supabase } from "@/lib/db";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TRIAGE_SUFFIXES = ["haswebsite", "nowebsite", "deadwebsite", "freesubdomain", "pagebuilder"];

function stripTriageSuffix(normStem: string): string {
  for (const suffix of TRIAGE_SUFFIXES) {
    if (normStem.endsWith(suffix)) {
      return normStem.slice(0, -suffix.length);
    }
  }
  return normStem;
}

function pdfMatchesNormName(pdfStem: string, normName: string): boolean {
  const n = normalize(pdfStem);
  const nBase = stripTriageSuffix(n);
  if (n === normName || nBase === normName) return true;
  if (normName.length >= 15) {
    if (
      n.startsWith(normName) ||
      normName.startsWith(n) ||
      nBase.startsWith(normName) ||
      normName.startsWith(nBase)
    )
      return true;
    // Lenient: "Air & Electric" vs "Air and Electric" → same norm if we collapse "and"
    const nCompact = n.replace(/and/g, "");
    const nameCompact = normName.replace(/and/g, "");
    if (nCompact === nameCompact || nCompact.includes(nameCompact) || nameCompact.includes(nCompact))
      return true;
  }
  return false;
}

// Prefer parent repo reports (where PDFs usually live), then cwd/reports
const REPORT_DIR_CANDIDATES = [
  () => path.resolve(process.cwd(), "..", "reports"),
  () => path.join(process.cwd(), "reports"),
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const { data: biz } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", numericId)
    .single();

  if (!biz?.name) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const normName = normalize(biz.name);
  let match: string | null = null;
  let reportsDir = "";

  for (const getDir of REPORT_DIR_CANDIDATES) {
    const dir = getDir();
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    const pdfFiles = files.filter((f) => f.endsWith("_audit.pdf"));
    const m =
      pdfFiles.find((f) => pdfMatchesNormName(f.replace(/_audit\.pdf$/, ""), normName)) ?? null;
    if (m) {
      match = m;
      reportsDir = dir;
      break;
    }
  }

  if (!match) {
    return NextResponse.json({ error: "No audit PDF for this business" }, { status: 404 });
  }

  const filePath = path.join(reportsDir, match);
  const buffer = await readFile(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${match}"`,
    },
  });
}
