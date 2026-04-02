-- Voice Agent tables for NWS Media Engine
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS voice_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text NOT NULL,
  phone text,
  website text,
  address text,
  timezone text DEFAULT 'America/New_York',
  hours jsonb,
  tone text DEFAULT 'professional',
  custom_rules text,
  cta_priority jsonb,
  transfer_number text,
  call_direction text DEFAULT 'inbound',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES voice_businesses(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES voice_businesses(id) ON DELETE CASCADE,
  vapi_assistant_id text,
  name text NOT NULL,
  default_language text DEFAULT 'en',
  enabled_languages jsonb DEFAULT '["en"]',
  greetings jsonb,
  system_prompt text,
  prompt_history jsonb DEFAULT '[]',
  voice_config jsonb,
  stt_config jsonb,
  status text DEFAULT 'draft',
  phone_number_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES voice_assistants(id),
  vapi_call_id text,
  direction text DEFAULT 'test',
  language_used text,
  duration_seconds integer,
  transcript jsonb,
  outcome text,
  summary text,
  cost numeric,
  vapi_metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_knowledge_docs_business ON voice_knowledge_docs(business_id);
CREATE INDEX IF NOT EXISTS idx_voice_assistants_business ON voice_assistants(business_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_assistant ON voice_calls(assistant_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_vapi_id ON voice_calls(vapi_call_id);

ALTER TABLE voice_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for voice_businesses" ON voice_businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for voice_knowledge_docs" ON voice_knowledge_docs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for voice_assistants" ON voice_assistants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for voice_calls" ON voice_calls FOR ALL USING (true) WITH CHECK (true);
