import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import path from "path";

const DB_PATH = path.join(process.cwd(), "voice_agent.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const voiceBusinesses = sqliteTable("voice_businesses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  timezone: text("timezone").default("America/New_York"),
  hours: text("hours"),
  tone: text("tone").default("professional"),
  customRules: text("custom_rules"),
  ctaPriority: text("cta_priority"),
  transferNumber: text("transfer_number"),
  callDirection: text("call_direction").default("inbound"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const voiceKnowledgeDocs = sqliteTable("voice_knowledge_docs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  businessId: text("business_id").notNull().references(() => voiceBusinesses.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const voiceAssistants = sqliteTable("voice_assistants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  businessId: text("business_id").notNull().references(() => voiceBusinesses.id, { onDelete: "cascade" }),
  vapiAssistantId: text("vapi_assistant_id"),
  name: text("name").notNull(),
  defaultLanguage: text("default_language").default("en"),
  enabledLanguages: text("enabled_languages").default('["en"]'),
  greetings: text("greetings"),
  systemPrompt: text("system_prompt"),
  promptHistory: text("prompt_history").default("[]"),
  voiceConfig: text("voice_config"),
  sttConfig: text("stt_config"),
  status: text("status").default("draft"),
  phoneNumberId: text("phone_number_id"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const voiceCalls = sqliteTable("voice_calls", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  assistantId: text("assistant_id").notNull().references(() => voiceAssistants.id),
  vapiCallId: text("vapi_call_id"),
  direction: text("direction").default("test"),
  languageUsed: text("language_used"),
  durationSeconds: integer("duration_seconds"),
  transcript: text("transcript"),
  outcome: text("outcome"),
  summary: text("summary"),
  cost: real("cost"),
  vapiMetadata: text("vapi_metadata"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const db = drizzle(sqlite);
export { sqlite };

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS voice_businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    address TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    hours TEXT,
    tone TEXT DEFAULT 'professional',
    custom_rules TEXT,
    cta_priority TEXT,
    transfer_number TEXT,
    call_direction TEXT DEFAULT 'inbound',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS voice_knowledge_docs (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES voice_businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS voice_assistants (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES voice_businesses(id) ON DELETE CASCADE,
    vapi_assistant_id TEXT,
    name TEXT NOT NULL,
    default_language TEXT DEFAULT 'en',
    enabled_languages TEXT DEFAULT '["en"]',
    greetings TEXT,
    system_prompt TEXT,
    prompt_history TEXT DEFAULT '[]',
    voice_config TEXT,
    stt_config TEXT,
    status TEXT DEFAULT 'draft',
    phone_number_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS voice_calls (
    id TEXT PRIMARY KEY,
    assistant_id TEXT NOT NULL REFERENCES voice_assistants(id),
    vapi_call_id TEXT,
    direction TEXT DEFAULT 'test',
    language_used TEXT,
    duration_seconds INTEGER,
    transcript TEXT,
    outcome TEXT,
    summary TEXT,
    cost REAL,
    vapi_metadata TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
