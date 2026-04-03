import { up as up001 } from './001_initial_schema';
import { up as up002 } from './002_employee_profile';
import { up as up003 } from './003_notifications_and_sequences';
import { up as up004 } from './004_project_management';
import { up as up005 } from './005_onboarding_links';
import { up as up006 } from './006_invite_links';
import { up as up007 } from './007_chat_and_meetings';
import { up as up008 } from './008_time_tracking';
import { up as up009 } from './009_training';
import { up as up010 } from './010_course_progress';
import { up as up011 } from './011_training_courses';
import { up as up012 } from './012_google_oauth';
import { up as up013 } from './013_documents';
import { up as up014 } from './014_dialer';
import { up as up015 } from './015_universal_invites';
import { up as up016 } from './016_user_activity_tracking';
import { up as up017 } from './017_client_intake_fields';
import { up as up018 } from './018_simulator_sessions';
import pool from '../config/database';

async function runSafe(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ${name} applied.`);
  } catch (error: any) {
    if (error?.code === '42710' || error?.code === '42P07') {
      console.log(`  ${name} skipped (already applied).`);
    } else {
      throw error;
    }
  }
}

async function migrate() {
  console.log('Running migrations...');
  try {
    await runSafe('001_initial_schema', up001);
    await runSafe('002_employee_profile', up002);
    await runSafe('003_notifications_and_sequences', up003);
    await runSafe('004_project_management', up004);
    await runSafe('005_onboarding_links', up005);
    await runSafe('006_invite_links', up006);
    await runSafe('007_chat_and_meetings', up007);
    await runSafe('008_time_tracking', up008);
    await runSafe('009_training', up009);
    await runSafe('010_course_progress', up010);
    await runSafe('011_training_courses', up011);
    await runSafe('012_google_oauth', up012);
    await runSafe('013_documents', up013);
    await runSafe('014_dialer', up014);
    await runSafe('015_universal_invites', up015);
    await runSafe('016_user_activity_tracking', up016);
    await runSafe('017_client_intake_fields', up017);
    await runSafe('018_simulator_sessions', up018);
    console.log('All migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
