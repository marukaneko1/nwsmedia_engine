interface PromptInput {
  business: {
    name: string;
    industry: string;
    address: string | null;
    hours: string | null;
    tone: string | null;
    custom_rules: string | null;
    cta_priority: string | null;
    transfer_number: string | null;
    call_direction: string | null;
  };
  knowledgeDocs: { type: string; title: string; content: string; metadata: string | null }[];
  enabledLanguages: string[];
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", yi: "Yiddish", es: "Spanish", fr: "French",
  he: "Hebrew", ru: "Russian", multi: "Auto-Detect",
};

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: "Maintain a professional, polished tone at all times. Be courteous and businesslike.",
  friendly: "Be warm, approachable, and conversational. Use a friendly tone that makes callers feel welcome.",
  casual: "Keep things relaxed and casual. Speak naturally as if chatting with a neighbor.",
  luxury: "Adopt an elegant, refined tone. Convey exclusivity and premium service in every interaction.",
};

const CTA_DESCRIPTIONS: Record<string, string> = {
  book_appointment: "Try to book an appointment. Ask for their preferred date, time, and any relevant details.",
  collect_lead: "Collect the caller's name, phone number, and email address for follow-up.",
  answer_question: "Answer the caller's question thoroughly using the knowledge base provided.",
  take_message: "Take a detailed message including the caller's name, callback number, and the reason for their call.",
  upsell: "Mention relevant additional services or upgrades that might benefit the caller based on their inquiry.",
  qualify_lead: "Determine if the prospect is a good fit by asking about their needs, budget, and timeline.",
  schedule_demo: "Offer to schedule a demo or consultation. Ask for their availability.",
  confirm_interest: "Confirm the prospect's interest and next steps. Summarize what was discussed.",
};

function buildIdentitySection(business: PromptInput["business"]): string {
  const lines: string[] = [];
  const direction = business.call_direction || "inbound";
  lines.push("## Identity & Role");
  if (direction === "outbound") {
    lines.push(`You are an outbound calling agent for ${business.name}, a ${business.industry} business${business.address ? ` located at ${business.address}` : ""}.`);
    lines.push("You are the one initiating this call. The person you are speaking to did NOT call you — you called them.");
    lines.push("Introduce yourself clearly at the start: state your name (or company name), why you are calling, and ask if now is a good time to talk.");
    lines.push("If they say it is not a good time, politely ask when would be better and offer to call back.");
    lines.push("Be respectful of their time. Do not be pushy or aggressive.");
  } else if (direction === "both") {
    lines.push(`You are the virtual phone assistant for ${business.name}, a ${business.industry} business${business.address ? ` located at ${business.address}` : ""}.`);
    lines.push("You handle both inbound calls from customers and outbound calls to leads and prospects.");
    lines.push("When making an outbound call, introduce yourself clearly and state the purpose of the call.");
    lines.push("When receiving an inbound call, greet the caller warmly and ask how you can help.");
  } else {
    lines.push(`You are the virtual phone assistant for ${business.name}, a ${business.industry} business${business.address ? ` located at ${business.address}` : ""}.`);
  }
  const toneDesc = TONE_DESCRIPTIONS[business.tone || "professional"] || TONE_DESCRIPTIONS["professional"];
  lines.push(toneDesc);
  lines.push("Never reveal that you are an AI unless the caller explicitly asks.");
  lines.push("Keep all responses under 3 sentences. Be concise and direct.");
  lines.push('Avoid filler words like "um", "uh", "well", "so", "like", or "you know".');
  return lines.join("\n");
}

function buildHoursSection(hours: string | null): string {
  if (!hours) return "";
  let parsed: Record<string, string>;
  try { parsed = JSON.parse(hours); } catch { return ""; }
  const lines: string[] = ["## Operating Hours"];
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const day of dayOrder) {
    const value = parsed[day];
    if (value) lines.push(`- **${day.charAt(0).toUpperCase() + day.slice(1)}**: ${value}`);
  }
  lines.push("");
  lines.push('If a caller asks "are you open now?", check the current day and time against these hours and respond accordingly.');
  lines.push("If calling after hours, let them know the business is currently closed, provide the next opening time, and offer to take a message.");
  return lines.join("\n");
}

function buildServicesSection(docs: PromptInput["knowledgeDocs"]): string {
  const services = docs.filter(d => d.type === "services");
  if (services.length === 0) return "";
  const lines: string[] = ["## Services"];
  for (const svc of services) {
    lines.push(`### ${svc.title}`);
    lines.push(svc.content);
    if (svc.metadata) {
      try {
        const meta = JSON.parse(svc.metadata);
        const details: string[] = [];
        if (meta.price) details.push(`Price: ${meta.price}`);
        if (meta.duration) details.push(`Duration: ${meta.duration}`);
        if (details.length > 0) lines.push(details.join(" | "));
      } catch { /* ignore */ }
    }
    lines.push("");
  }
  lines.push("If asked about a service not listed above, say you're not sure about that specific service and offer to connect them with a team member who can help.");
  return lines.join("\n");
}

function buildFaqSection(docs: PromptInput["knowledgeDocs"]): string {
  const faqs = docs.filter(d => d.type === "faq");
  if (faqs.length === 0) return "";
  const lines: string[] = ["## Frequently Asked Questions"];
  for (const faq of faqs) {
    lines.push(`Q: ${faq.title}`);
    lines.push(`A: ${faq.content}`);
    lines.push("");
  }
  lines.push("If asked a question not covered above, let the caller know you don't have that information on hand and offer to take a message or transfer them to someone who can help.");
  return lines.join("\n");
}

function buildPoliciesSection(docs: PromptInput["knowledgeDocs"]): string {
  const policies = docs.filter(d => d.type === "policies");
  if (policies.length === 0) return "";
  const lines: string[] = ["## Policies"];
  for (const policy of policies) {
    lines.push(`### ${policy.title}`);
    lines.push(policy.content);
    lines.push("");
  }
  return lines.join("\n");
}

function buildCustomRulesSection(customRules: string | null): string {
  if (!customRules || customRules.trim() === "") return "";
  return ["## Hard Rules (ALWAYS FOLLOW)", customRules, "These rules override any other instructions."].join("\n");
}

function buildLanguageSection(enabledLanguages: string[]): string {
  if (enabledLanguages.length === 0) return "";
  const languageList = enabledLanguages.map(code => LANGUAGE_NAMES[code] || code).join(", ");
  const lines: string[] = [
    "## Language Instructions",
    `You are capable of communicating in the following languages: ${languageList}.`,
    "Detect the caller's language from their first message and respond in the same language.",
    "If the caller switches languages mid-conversation, switch with them seamlessly.",
  ];
  if (enabledLanguages.includes("yi")) {
    lines.push("");
    lines.push("### Yiddish-Specific Instructions");
    lines.push("When speaking Yiddish, adopt a warm, familiar tone.");
    lines.push('Greet Yiddish-speaking callers with "\u05E9\u05DC\u05D5\u05DD \u05E2\u05DC\u05D9\u05DB\u05DD" (Shalom Aleichem).');
    lines.push("Many Yiddish speakers mix in English words and phrases \u2014 this is normal. Understand and respond naturally to mixed Yiddish/English speech.");
  }
  return lines.join("\n");
}

function buildEscalationSection(transferNumber: string | null): string {
  if (!transferNumber) return "";
  const lines: string[] = [
    "## Escalation & Transfer",
    `Transfer the caller to a human agent at ${transferNumber} in any of these situations:`,
    "1. The caller explicitly asks to speak with a human or a representative.",
    "2. The caller is upset, frustrated, or raising their voice.",
    "3. The inquiry involves billing, legal matters, or insurance.",
    "4. You are unsure about critical information that could impact the caller's decision.",
    "5. The conversation has gone on for more than 5 minutes without resolution.",
    "",
    '"Let me connect you with a team member who can help you further. One moment please."',
  ];
  return lines.join("\n");
}

function buildCtaSection(ctaPriority: string | null): string {
  if (!ctaPriority) return "";
  let priorities: string[];
  try { priorities = JSON.parse(ctaPriority); } catch { return ""; }
  if (!Array.isArray(priorities) || priorities.length === 0) return "";
  const lines: string[] = [
    "## Call-to-Action Priorities",
    "During each call, try to accomplish these goals in order of priority:",
    "",
  ];
  priorities.forEach((cta, index) => {
    const description = CTA_DESCRIPTIONS[cta] || cta;
    lines.push(`${index + 1}. **${cta}**: ${description}`);
  });
  return lines.join("\n");
}

export function generateSystemPrompt(input: PromptInput): string {
  const sections = [
    buildIdentitySection(input.business),
    buildHoursSection(input.business.hours),
    buildServicesSection(input.knowledgeDocs),
    buildFaqSection(input.knowledgeDocs),
    buildPoliciesSection(input.knowledgeDocs),
    buildCustomRulesSection(input.business.custom_rules),
    buildLanguageSection(input.enabledLanguages),
    buildEscalationSection(input.business.transfer_number),
    buildCtaSection(input.business.cta_priority),
  ].filter(section => section.length > 0);
  return sections.join("\n\n---\n\n");
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
