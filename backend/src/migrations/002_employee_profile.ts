import { query } from '../config/database';

export async function up() {
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE,
      ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS date_of_birth DATE,
      ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
      ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS address_state VARCHAR(50),
      ADD COLUMN IF NOT EXISTS address_zip VARCHAR(20),
      ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE,
      ADD COLUMN IF NOT EXISTS schedule JSONB,
      ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);
}
