import { db, voiceBusinesses } from "@/lib/voice/db";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = db.select().from(voiceBusinesses).orderBy(desc(voiceBusinesses.createdAt)).all();
  return Response.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, industry } = body;
  if (!name || !industry) return Response.json({ error: "name and industry are required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(voiceBusinesses).values({
    id, name, industry,
    phone: body.phone ?? null,
    website: body.website ?? null,
    address: body.address ?? null,
    timezone: body.timezone ?? "America/New_York",
    hours: body.hours ? (typeof body.hours === "string" ? body.hours : JSON.stringify(body.hours)) : null,
    tone: body.tone ?? "professional",
    customRules: body.custom_rules ?? null,
    ctaPriority: body.cta_priority ? (typeof body.cta_priority === "string" ? body.cta_priority : JSON.stringify(body.cta_priority)) : null,
    transferNumber: body.transfer_number ?? null,
    callDirection: body.call_direction ?? "inbound",
    createdAt: now,
    updatedAt: now,
  }).run();

  const created = db.select().from(voiceBusinesses).where(eq(voiceBusinesses.id, id)).get();
  return Response.json(created, { status: 201 });
}
