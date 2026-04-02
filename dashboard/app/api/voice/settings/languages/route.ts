import { getAvailableLanguages, getLanguageStack } from "@/lib/voice/language-stack";

export const runtime = "nodejs";

export async function GET() {
  const languages = getAvailableLanguages();
  const stacks: Record<string, any> = {};
  for (const lang of languages) stacks[lang.code] = getLanguageStack(lang.code);
  return Response.json({ languages, stacks });
}
