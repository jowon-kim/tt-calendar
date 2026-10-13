/**
 * schema.sql을 DB에 실행합니다 — Neon SQL Editor에 붙여넣는 대신 씁니다.
 *
 *   npm run schema
 *
 * 몇 번을 돌려도 안전합니다. schema.sql이 전부 `create table if not exists`와
 * `alter table ... add column if not exists`로 쓰여 있어서요.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * 문장 단위로 자릅니다. 주석을 먼저 걷어내는 건 주석 안의 세미콜론에
 * 걸려 잘못 잘리지 않게 하려는 것입니다. 문자열 리터럴 안에 `--`가 들어가면
 * 이 방식이 깨지는데, schema.sql에는 그런 값이 없습니다.
 */
export function statements(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** exec(문장)를 하나씩 부릅니다. 테스트에서는 PGlite를 넘깁니다. */
export async function runSchema(exec, text) {
  const sql = text ?? fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
  const list = statements(sql);
  for (const stmt of list) await exec(stmt);
  return list.length;
}

/* 직접 실행했을 때만 진짜 DB에 붙습니다 (import 하면 안 붙습니다). */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Run `vercel env pull .env.local`, or set it yourself.');
    process.exit(1);
  }
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  const n = await runSchema((stmt) => sql.query(stmt));
  console.log(`Tables and indexes are up to date — ran ${n} statements.`);
}
