import { query } from '../config/database';

export async function up() {
  const col = await query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'invite_links' AND column_name = 'max_uses'`
  );
  if (col.rows.length === 0) {
    await query(`ALTER TABLE invite_links ADD COLUMN max_uses INT`);
    await query(`ALTER TABLE invite_links ADD COLUMN use_count INT DEFAULT 0`);
  }
}
