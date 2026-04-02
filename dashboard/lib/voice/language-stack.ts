export interface LanguageStackConfig {
  transcriber: { provider: string; model: string; language?: string };
  voice: { provider: string; voiceId: string };
  estimatedCostPerMin: number;
}

const LANGUAGE_STACKS: Record<string, LanguageStackConfig> = {
  en: {
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    voice: { provider: "deepgram", voiceId: "asteria" },
    estimatedCostPerMin: 0.095,
  },
  yi: {
    transcriber: { provider: "deepgram", model: "whisper-large", language: "yi" },
    voice: { provider: "azure", voiceId: "de-DE-ConradNeural" },
    estimatedCostPerMin: 0.13,
  },
  es: {
    transcriber: { provider: "deepgram", model: "nova-3", language: "es" },
    voice: { provider: "deepgram", voiceId: "estrella" },
    estimatedCostPerMin: 0.095,
  },
  fr: {
    transcriber: { provider: "deepgram", model: "nova-3", language: "fr" },
    voice: { provider: "azure", voiceId: "fr-FR-DeniseNeural" },
    estimatedCostPerMin: 0.1,
  },
  he: {
    transcriber: { provider: "deepgram", model: "nova-3", language: "he" },
    voice: { provider: "azure", voiceId: "he-IL-AvriNeural" },
    estimatedCostPerMin: 0.1,
  },
  ru: {
    transcriber: { provider: "deepgram", model: "nova-3", language: "ru" },
    voice: { provider: "azure", voiceId: "ru-RU-DmitryNeural" },
    estimatedCostPerMin: 0.1,
  },
  multi: {
    transcriber: { provider: "deepgram", model: "nova-3", language: "multi" },
    voice: { provider: "azure", voiceId: "en-US-AndrewMultilingualNeural" },
    estimatedCostPerMin: 0.12,
  },
};

export function getLanguageStack(lang: string): LanguageStackConfig {
  return LANGUAGE_STACKS[lang] || LANGUAGE_STACKS["en"];
}

export function getAvailableLanguages() {
  return [
    { code: "en", name: "English", flag: "\u{1F1FA}\u{1F1F8}" },
    { code: "yi", name: "Yiddish", flag: "\u2721\uFE0F" },
    { code: "es", name: "Spanish", flag: "\u{1F1EA}\u{1F1F8}" },
    { code: "fr", name: "French", flag: "\u{1F1EB}\u{1F1F7}" },
    { code: "he", name: "Hebrew", flag: "\u{1F1EE}\u{1F1F1}" },
    { code: "ru", name: "Russian", flag: "\u{1F1F7}\u{1F1FA}" },
    { code: "multi", name: "Auto-Detect", flag: "\u{1F310}" },
  ];
}
