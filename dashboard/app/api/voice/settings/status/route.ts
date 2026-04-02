import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status: Record<string, { connected: boolean; error?: string }> = {
    vapi: { connected: false },
    openai: { connected: false },
    deepgram: { connected: false },
  };

  if (process.env.VAPI_API_KEY) {
    try {
      await vapi.listPhoneNumbers();
      status.vapi = { connected: true };
    } catch (err: any) {
      status.vapi = { connected: false, error: err.message };
    }
  }

  status.openai.connected = !!process.env.OPENAI_API_KEY;
  status.deepgram.connected = !!process.env.DEEPGRAM_API_KEY;
  return Response.json(status);
}
