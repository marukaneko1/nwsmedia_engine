import { db, voiceAssistants, voiceBusinesses } from "@/lib/voice/db";
import { eq } from "drizzle-orm";
import { getLanguageStack, getAvailableLanguages } from "@/lib/voice/language-stack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const asst = db
    .select()
    .from(voiceAssistants)
    .where(eq(voiceAssistants.id, assistantId))
    .get();
  if (!asst) return Response.json({ error: "Assistant not found" }, { status: 404 });
  if (!asst.vapiAssistantId)
    return Response.json({ error: "Not deployed to VAPI yet" }, { status: 400 });

  const biz = db
    .select()
    .from(voiceBusinesses)
    .where(eq(voiceBusinesses.id, asst.businessId))
    .get();
  const enabledLanguages: string[] = JSON.parse(asst.enabledLanguages || '["en"]');
  const greetings = asst.greetings ? JSON.parse(asst.greetings) : {};
  const languageStacks: Record<string, any> = {};
  for (const lang of enabledLanguages) languageStacks[lang] = getLanguageStack(lang);

  return Response.json({
    vapiAssistantId: asst.vapiAssistantId,
    vapiPublicKey: process.env.VAPI_PUBLIC_KEY || "",
    assistantName: asst.name,
    businessName: biz?.name || "",
    defaultLanguage: asst.defaultLanguage || "en",
    enabledLanguages,
    greetings,
    languageStacks,
    availableLanguages: getAvailableLanguages(),
  });
}
