import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS phone_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number VARCHAR(20) NOT NULL,
      account_sid VARCHAR(100) NOT NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'twilio',
      is_active BOOLEAN NOT NULL DEFAULT true,
      forward_number VARCHAR(20),
      friendly_name VARCHAR(100),
      number_type VARCHAR(20),
      signed_in_forward BOOLEAN NOT NULL DEFAULT false,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_assignments_number_active
      ON phone_assignments (phone_number, is_active) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_phone_assignments_user ON phone_assignments (user_id);
    CREATE INDEX IF NOT EXISTS idx_phone_assignments_account_sid ON phone_assignments (account_sid);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS call_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_sid VARCHAR(100) UNIQUE NOT NULL,
      from_number VARCHAR(50) NOT NULL,
      to_number VARCHAR(50) NOT NULL,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      duration INTEGER,
      direction VARCHAR(30) NOT NULL,
      status VARCHAR(30) NOT NULL,
      recording_url TEXT,
      recording_sid VARCHAR(100),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_call_history_call_sid ON call_history (call_sid);
    CREATE INDEX IF NOT EXISTS idx_call_history_from ON call_history (from_number);
    CREATE INDEX IF NOT EXISTS idx_call_history_to ON call_history (to_number);
    CREATE INDEX IF NOT EXISTS idx_call_history_user ON call_history (user_id);
    CREATE INDEX IF NOT EXISTS idx_call_history_direction ON call_history (direction);
    CREATE INDEX IF NOT EXISTS idx_call_history_status ON call_history (status);
    CREATE INDEX IF NOT EXISTS idx_call_history_created ON call_history (created_at);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS dialer_routing_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      retry_interval VARCHAR(10) NOT NULL DEFAULT '1hr',
      auto_requeue BOOLEAN NOT NULL DEFAULT true,
      call_order VARCHAR(20) NOT NULL DEFAULT 'priority',
      local_presence BOOLEAN NOT NULL DEFAULT false,
      between_call_delay INTEGER NOT NULL DEFAULT 3,
      local_presence_default BOOLEAN NOT NULL DEFAULT false,
      auto_dial_default BOOLEAN NOT NULL DEFAULT true,
      audio_input_device_id VARCHAR(255),
      audio_output_device_id VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_dialer_settings_user ON dialer_routing_settings (user_id);
  `);

  // Add Twilio credential columns to users if they don't exist
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'twilio_account_sid') THEN
        ALTER TABLE users ADD COLUMN twilio_account_sid VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'twilio_auth_token') THEN
        ALTER TABLE users ADD COLUMN twilio_auth_token VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'twilio_api_key_sid') THEN
        ALTER TABLE users ADD COLUMN twilio_api_key_sid VARCHAR(100);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'twilio_api_key_secret') THEN
        ALTER TABLE users ADD COLUMN twilio_api_key_secret VARCHAR(255);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'twilio_app_sid') THEN
        ALTER TABLE users ADD COLUMN twilio_app_sid VARCHAR(100);
      END IF;
    END
    $$;
  `);
}
