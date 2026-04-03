import { query } from '../config/database';
import pool from '../config/database';

async function wipe() {
  console.log('Wiping all data from database (preserving schema)...\n');

  const tables = [
    'training_course_progress',
    'training_completions',
    'training_materials',
    'time_entries',
    'meeting_participants',
    'meetings',
    'messages',
    'channel_members',
    'channels',
    'project_milestones',
    'project_notes',
    'commissions',
    'payment_links',
    'activities',
    'sequence_enrollments',
    'referrals',
    'portal_tokens',
    'onboarding_links',
    'files',
    'clients',
    'deals',
    'leads',
    'notifications',
    'audit_log',
    'invite_links',
  ];

  for (const table of tables) {
    try {
      const result = await query(`DELETE FROM ${table}`);
      console.log(`  ${table}: ${result.rowCount} rows deleted`);
    } catch (err: any) {
      if (err.code === '42P01') {
        console.log(`  ${table}: table does not exist (skipping)`);
      } else {
        console.error(`  ${table}: ERROR - ${err.message}`);
      }
    }
  }

  // Clear team_lead references before deleting users
  try {
    await query('UPDATE teams SET team_lead_id = NULL');
    console.log('  teams: cleared team_lead references');
  } catch { /* ignore */ }

  try {
    const result = await query('DELETE FROM users');
    console.log(`  users: ${result.rowCount} rows deleted`);
  } catch (err: any) {
    console.error(`  users: ERROR - ${err.message}`);
  }

  try {
    const result = await query('DELETE FROM teams');
    console.log(`  teams: ${result.rowCount} rows deleted`);
  } catch (err: any) {
    console.error(`  teams: ERROR - ${err.message}`);
  }

  // Re-seed the default chat channels (these are app config, not demo data)
  const defaultChannels = [
    { name: 'general', type: 'team', description: 'Company-wide announcements and discussion' },
    { name: 'closers', type: 'role', description: 'Closer team chat' },
    { name: 'vas', type: 'role', description: 'VA team chat' },
    { name: 'ops', type: 'role', description: 'Operations team chat' },
  ];

  for (const ch of defaultChannels) {
    try {
      await query(
        `INSERT INTO channels (name, type, description) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [ch.name, ch.type, ch.description]
      );
    } catch { /* ignore if table doesn't exist */ }
  }
  console.log('\n  Re-created default chat channels (#general, #closers, #vas, #ops)');

  console.log('\nDatabase wiped. All demo/seed data has been removed.');
  console.log('You can now register a fresh admin account and start with real data.\n');

  await pool.end();
}

wipe().catch((err) => {
  console.error('Wipe failed:', err);
  process.exit(1);
});
