import * as vapi from "@/lib/voice/vapi-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const numbers = await vapi.listPhoneNumbers();
    return Response.json(numbers);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const { assistantId } = await req.json();
  if (!assistantId) return Response.json({ error: "assistantId required" }, { status: 400 });
  try {
    const number = await vapi.createPhoneNumber(assistantId);
    return Response.json(number, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
