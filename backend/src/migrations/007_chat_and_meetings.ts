import { query } from '../config/database';

export async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'team' CHECK (type IN ('team', 'role', 'meeting', 'direct')),
      description TEXT,
      created_by_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS channel_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(channel_id, user_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id),
      content TEXT,
      message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'meeting_link', 'file')),
      file_url VARCHAR(500),
      file_name VARCHAR(255),
      file_type VARCHAR(100),
      edited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      scheduled_at TIMESTAMPTZ NOT NULL,
      duration_minutes INT DEFAULT 30,
      recurrence VARCHAR(20) DEFAULT 'none' CHECK (recurrence IN ('none', 'weekly', 'biweekly', 'monthly')),
      google_meet_link VARCHAR(500),
      channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
      created_by_id UUID NOT NULL REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_meetings_creator ON meetings(created_by_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS meeting_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
      UNIQUE(meeting_id, user_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id)`);

  // Seed default channels
  const defaults = [
    { name: 'general', type: 'team', description: 'Company-wide announcements and discussion' },
    { name: 'closers', type: 'role', description: 'Closer team chat' },
    { name: 'vas', type: 'role', description: 'VA team chat' },
    { name: 'ops', type: 'role', description: 'Operations team chat' },
  ];

  for (const ch of defaults) {
    const exists = await query(`SELECT id FROM channels WHERE name = $1 AND type = $2`, [ch.name, ch.type]);
    if (exists.rows.length > 0) continue;
    const channelResult = await query(
      `INSERT INTO channels (name, type, description) VALUES ($1, $2, $3) RETURNING id`,
      [ch.name, ch.type, ch.description]
    );
    const channelId = channelResult.rows[0].id;

    // Add users to channels based on type
    if (ch.type === 'team') {
      // Everyone joins #general
      await query(
        `INSERT INTO channel_members (channel_id, user_id)
         SELECT $1, id FROM users WHERE status = 'active'
         ON CONFLICT DO NOTHING`,
        [channelId]
      );
    } else if (ch.type === 'role') {
      const roleMap: Record<string, string[]> = {
        closers: ['closer', 'admin'],
        vas: ['va', 'admin'],
        ops: ['ops', 'admin'],
      };
      const roles = roleMap[ch.name] || [];
      if (roles.length > 0) {
        await query(
          `INSERT INTO channel_members (channel_id, user_id)
           SELECT $1, id FROM users WHERE status = 'active' AND role = ANY($2)
           ON CONFLICT DO NOTHING`,
          [channelId, roles]
        );
      }
    }
  }
}
