import type { LanguageConfig } from "@/types/voice";

export const LANGUAGES: LanguageConfig[] = [
  { code: "en", name: "English", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "yi", name: "Yiddish", flag: "\u2721\uFE0F" },
  { code: "es", name: "Spanish", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "fr", name: "French", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "he", name: "Hebrew", flag: "\u{1F1EE}\u{1F1F1}" },
  { code: "ru", name: "Russian", flag: "\u{1F1F7}\u{1F1FA}" },
  { code: "multi", name: "Auto-Detect", flag: "\u{1F310}" },
];

export const INDUSTRIES = [
  "Dental", "Restaurant", "HVAC", "Retail", "Legal",
  "Medical", "Salon", "Auto Repair", "Real Estate", "Other",
] as const;

export const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "luxury", label: "Luxury" },
] as const;

export const CTA_OPTIONS = [
  { value: "book_appointment", label: "Book Appointment" },
  { value: "collect_lead", label: "Collect Lead Info" },
  { value: "answer_question", label: "Answer Question" },
  { value: "take_message", label: "Take Message" },
  { value: "upsell", label: "Upsell Services" },
  { value: "qualify_lead", label: "Qualify Lead" },
  { value: "schedule_demo", label: "Schedule Demo" },
  { value: "confirm_interest", label: "Confirm Interest" },
] as const;

export const OUTCOMES = ["resolved", "transferred", "abandoned", "error"] as const;
export const DIRECTIONS = ["inbound", "outbound", "test"] as const;

export const CALL_DIRECTIONS = [
  { value: "inbound", label: "Inbound", description: "Answer incoming calls from customers" },
  { value: "outbound", label: "Outbound", description: "Make outbound calls to leads and prospects" },
  { value: "both", label: "Both", description: "Handle both inbound and outbound calls" },
] as const;
