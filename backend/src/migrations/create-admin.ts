import bcrypt from 'bcrypt';
import { query } from '../config/database';
import pool from '../config/database';

async function createAdmin() {
  const email = 'admin@nwsmedia.com';
  const username = 'admin';
  const firstName = 'Maru';
  const lastName = 'Kane';
  const password = 'admin123!';

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.log('Admin account already exists.');
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const schedule = JSON.stringify({
    monday: '9am-5pm', tuesday: '9am-5pm', wednesday: '9am-5pm',
    thursday: '9am-5pm', friday: '9am-5pm', saturday: '', sunday: '',
  });

  await query(
    `INSERT INTO users (email, username, password_hash, first_name, last_name, role, phone, status, profile_completed, join_date, schedule)
     VALUES ($1, $2, $3, $4, $5, 'admin', '', 'active', TRUE, CURRENT_DATE, $6)`,
    [email, username, hash, firstName, lastName, schedule]
  );

  // Add admin to default chat channels
  const adminId = (await query('SELECT id FROM users WHERE email = $1', [email])).rows[0].id;
  const channels = (await query('SELECT id FROM channels')).rows;
  for (const ch of channels) {
    await query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [ch.id, adminId]
    );
  }

  console.log('Admin account created successfully.');
  console.log(`  Email:    ${email}`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log('');
  console.log('You can log in with either the email or username.');

  await pool.end();
}

createAdmin().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
