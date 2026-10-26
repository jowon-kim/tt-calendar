/**
 * Checks that the install is actually wired up.
 *
 *   npm run verify
 *
 * Walks the environment variables and the database and prints ✓ / ✗ for each.
 * One ✗ and it exits 1, so an agent can read the result and fix it on its own.
 * It does not send a notification — only a phone can tell you that worked.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const results = [];
const ok = (what) => results.push({ mark: '✓', what });
const bad = (what, how) => results.push({ mark: '✗', what, how });
const warn = (what, how) => results.push({ mark: '⚠', what, how });

/** Reads what `vercel env pull .env.local` writes. Never overrides what is already set. */
export function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
}

/**
 * Vercel will not hand back a value it stored as a Secret. `vercel env pull`
 * writes `[SENSITIVE]` in its place, and reading that as the real thing would
 * report a wrong value that is actually fine. So placeholders get their own answer.
 */
const HIDDEN = '[SENSITIVE]';
const hidden = (v) => v === HIDDEN;
const HIDDEN_HOW =
  'Vercel will not hand Secret values back, so this cannot be checked here ' +
  '(env pull writes [SENSITIVE] instead). Look at the value in the Vercel dashboard';

/*
 * The VAPID pair (and a fallback clock key) are not environment variables.
 * The app makes them on its first request and keeps them in the app_meta table
 * (lib/setup.js), so there is nothing to check here for them. People sign up
 * with their own username and password, so there is no shared password either.
 */
export async function checkEnv() {
  if (process.env.GOOGLE_CLIENT_IDS) ok('Google sign-in');
  else warn('Google sign-in', 'set GOOGLE_CLIENT_IDS to show "Continue with Google" (lib/google.js)');

  if (process.env.CRON_SECRET) ok('CRON_SECRET');
  else warn('CRON_SECRET',
    'not set, so the clock key is the one the app made in app_meta. Set CRON_SECRET so only you know it (Vercel Cron sends it as Bearer)');

  try {
    const { subject } = await import('./lib/push.js');
    const at = subject();
    if (hidden(at)) warn('push contact address', HIDDEN_HOW);
    else ok(`push contact address (${at})`);
  } catch {
    bad('push contact address', 'put your deployed URL in VAPID_SUBJECT or DIARY_URL (on Vercel, VERCEL_URL covers it)');
  }
}

const WANT = [
  'users', 'couples', 'couple_members', 'invites', 'sessions', 'login_failures', 'signups',
  'events', 'settings', 'photos', 'push_subs', 'reminders_sent', 'app_meta', 'active_days',
];
const MAKE_TABLES = 'the app creates them on its first request. To do it now, npm run schema';

/** query(text) -> rows. Tests pass PGlite in (the same trick as useClient in lib/db.js). */
export async function checkDb(query) {
  const rows = await query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  );
  ok('database connection');

  const have = new Set(rows.map((r) => r.table_name));
  const missing = WANT.filter((t) => !have.has(t));
  if (missing.length) return bad(`tables (${missing.join(', ')} missing)`, MAKE_TABLES);
  ok(`${WANT.length} tables`);

  /* An install upgraded from the single-couple version keeps its old rows without a couple_id. */
  const orphans = await query('select count(*)::int as n from events where couple_id is null');
  if (orphans[0]?.n) warn(`${orphans[0].n} events from the single-couple version`,
    'they have no calendar, so nobody sees them. Nothing is deleted — see the note at the top of schema.sql');
}

/** Prints what has piled up and returns { failed, warned }. */
export function report() {
  for (const r of results) console.log(`${r.mark} ${r.what}${r.how ? `\n    → ${r.how}` : ''}`);
  const failed = results.filter((r) => r.mark === '✗').length;
  const warned = results.filter((r) => r.mark === '⚠').length;
  console.log();
  if (failed) console.log(`${failed} still not right. Follow the arrows above and run this again.`);
  else console.log(warned ? `Ready (though ${warned} ⚠ worth a look).` : 'Ready.');
  return { failed, warned };
}

/* Only touches a real database when run directly (importing it does not). */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnvFile();

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const reachable = dbUrl && !hidden(dbUrl);
  if (reachable) ok('DATABASE_URL');
  else if (dbUrl) warn('DATABASE_URL', `${HIDDEN_HOW}. The app creates its tables on the first sign-in, so nothing is lost`);
  else bad('DATABASE_URL', 'attach a database with vercel integration add neon, then vercel env pull .env.local');

  await checkEnv();

  if (reachable) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(dbUrl);
      await checkDb((text) => sql.query(text));
    } catch (e) {
      bad('database connection', `${e.message} — check that DATABASE_URL is right`);
    }
  }

  if (report().failed) process.exit(1);
}
