import { db, voiceAssistants } from "@/lib/voice/db";
import { eq } from "drizzle-orm";
import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { assistantId, leads } = await req.json();
  if (!assistantId || !Array.isArray(leads) || leads.length === 0)
    return Response.json(
      { error: "assistantId and leads required" },
      { status: 400 }
    );
  if (leads.length > 50)
    return Response.json({ error: "Max 50 per batch" }, { status: 400 });

  const asst = db
    .select()
    .from(voiceAssistants)
    .where(eq(voiceAssistants.id, assistantId))
    .get();
  if (!asst?.vapiAssistantId)
    return Response.json({ error: "Assistant not deployed" }, { status: 400 });

  let phoneNumberId = asst.phoneNumberId || null;
  if (!phoneNumberId) {
    try {
      const nums = await vapi.listPhoneNumbers();
      if (Array.isArray(nums) && nums.length > 0) phoneNumberId = nums[0].id;
    } catch {
      /**/
    }
  }
  if (!phoneNumberId)
    return Response.json({ error: "No phone number" }, { status: 400 });

  const results: {
    phoneNumber: string;
    name?: string;
    success: boolean;
    callId?: string;
    error?: string;
  }[] = [];
  for (const lead of leads) {
    const phone = lead.phone || lead.phoneNumber || lead.number;
    if (!phone) {
      results.push({
        phoneNumber: "unknown",
        name: lead.name,
        success: false,
        error: "No phone",
      });
      continue;
    }
    const formatted = phone.startsWith("+")
      ? phone
      : `+1${phone.replace(/\D/g, "")}`;
    try {
      const call = await vapi.createOutboundCall({
        assistantId: asst.vapiAssistantId,
        phoneNumberId,
        customer: { number: formatted, name: lead.name || undefined },
      });
      results.push({
        phoneNumber: formatted,
        name: lead.name,
        success: true,
        callId: call.id,
      });
      await new Promise((r) => setTimeout(r, 500));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        phoneNumber: formatted,
        name: lead.name,
        success: false,
        error: message,
      });
    }
  }

  return Response.json({
    total: leads.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
