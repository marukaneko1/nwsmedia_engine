export interface VoiceBusiness {
  id: string;
  name: string;
  industry: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  timezone: string | null;
  hours: string | null;
  tone: string | null;
  customRules: string | null;
  ctaPriority: string | null;
  transferNumber: string | null;
  callDirection: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface VoiceKnowledgeDoc {
  id: string;
  businessId: string;
  type: "services" | "faq" | "policies" | "hours" | "custom";
  title: string;
  content: string;
  metadata: string | null;
  sortOrder: number | null;
  createdAt: string | null;
}

export interface VoiceAssistant {
  id: string;
  businessId: string;
  vapiAssistantId: string | null;
  name: string;
  defaultLanguage: string | null;
  enabledLanguages: string | null;
  greetings: string | null;
  systemPrompt: string | null;
  promptHistory: string | null;
  voiceConfig: string | null;
  sttConfig: string | null;
  status: string | null;
  phoneNumberId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  business_name?: string | null;
  business_industry?: string | null;
}

export interface VoiceCall {
  id: string;
  assistantId: string;
  vapiCallId: string | null;
  direction: string | null;
  languageUsed: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  outcome: string | null;
  summary: string | null;
  cost: number | null;
  vapiMetadata: string | null;
  createdAt: string | null;
  assistant_name?: string | null;
}

export interface TranscriptMessage {
  role: "assistant" | "user";
  text: string;
  timestamp: number;
  isFinal?: boolean;
}

export interface LanguageConfig {
  code: string;
  name: string;
  flag: string;
}

export interface AnalyticsOverview {
  totalCalls: number;
  activeAssistants: number;
  avgDuration: number;
  totalCost: number;
  callsThisMonth: number;
  callsLastMonth: number;
  totalMinutesThisMonth: number;
}

export interface CallVolumeEntry {
  day: string;
  count: number;
}

export interface LanguageDistEntry {
  language: string;
  count: number;
}

export interface OutcomeEntry {
  outcome: string;
  count: number;
}
