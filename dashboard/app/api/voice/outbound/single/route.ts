import { db, voiceAssistants } from "@/lib/voice/db";
import { eq } from "drizzle-orm";
import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { assistantId, phoneNumber } = await req.json();
  if (!assistantId || !phoneNumber)
    return Response.json(
      { error: "assistantId and phoneNumber required" },
      { status: 400 }
    );

  const asst = db
    .select()
    .from(voiceAssistants)
    .where(eq(voiceAssistants.id, assistantId))
    .get();
  if (!asst) return Response.json({ error: "Assistant not found" }, { status: 404 });
  if (!asst.vapiAssistantId)
    return Response.json({ error: "Not deployed to VAPI" }, { status: 400 });

  let phoneNumberId = asst.phoneNumberId || null;
  if (!phoneNumberId) {
    try {
      const nums = await vapi.listPhoneNumbers();
      if (Array.isArray(nums) && nums.length > 0) phoneNumberId = nums[0].id;
    } catch {
      /* ignore */
    }
  }
  if (!phoneNumberId)
    return Response.json({ error: "No phone number available" }, { status: 400 });

  const formatted = phoneNumber.startsWith("+")
    ? phoneNumber
    : `+1${phoneNumber.replace(/\D/g, "")}`;
  try {
    const call = await vapi.createOutboundCall({
      assistantId: asst.vapiAssistantId,
      phoneNumberId,
      customer: { number: formatted },
    });
    return Response.json({
      success: true,
      callId: call.id,
      phoneNumber: formatted,
      assistantName: asst.name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
