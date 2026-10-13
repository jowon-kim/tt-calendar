/**
 * 설치하는 사람이 할 일을 앱이 대신 합니다 — 표 만들기와 열쇠 만들기.
 *
 * 예전에는 브라우저 콘솔에서 키 넷을 만들어 Vercel에 붙여넣고, Neon SQL Editor에
 * schema.sql을 붙여넣어야 했습니다. 이제 Deploy 버튼에서 비밀번호 하나만 넣으면
 * 첫 요청이 나머지를 합니다.
 *
 * - 표: schema.sql의 지문을 app_meta에 적어두고, 지문이 다를 때만 돌립니다.
 *   전부 `if not exists`라 여러 번 돌아도 안전합니다
 * - 열쇠: 없으면 만들어 app_meta에 넣습니다. 한 번 들어간 값은 절대 바꾸지 않아요
 *
 * 인스턴스마다 처음 한 번만 DB를 읽고 그 뒤로는 기억해 둡니다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { sql, run } from './db.js';
import { runSchema } from '../schema.mjs';

const fingerprint = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

/** 표가 아직 없으면(막 만든 DB) null. */
async function readMeta() {
  try {
    const rows = await sql`select name, value from app_meta`;
    return Object.fromEntries(rows.map((r) => [r.name, r.value]));
  } catch {
    return null;
  }
}

/**
 * 한 문장으로 넣어서, 두 인스턴스가 동시에 만들어도 한쪽 것만 남습니다.
 * VAPID는 짝이 맞아야 해서 한 줄에 같이 담습니다 — 따로 담으면 공개키는 이쪽,
 * 비밀키는 저쪽 것이 남을 수 있어요.
 */
async function makeKeys() {
  const { default: webpush } = await import('web-push');
  const random = () => crypto.randomBytes(24).toString('hex');
  const vapid = JSON.stringify(webpush.generateVAPIDKeys());
  await sql`
    insert into app_meta (name, value)
    values ('cron_secret', ${random()}), ('vapid', ${vapid})
    on conflict (name) do nothing
  `;
}

async function load() {
  const text = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  const mark = fingerprint(text);

  let meta = await readMeta();
  if (meta?.schema !== mark) {
    await runSchema(run, text);
    await sql`
      insert into app_meta (name, value) values ('schema', ${mark})
      on conflict (name) do update set value = excluded.value
    `;
    meta = await readMeta();
  }

  if (!meta.cron_secret || !meta.vapid) {
    await makeKeys();
    meta = await readMeta();
  }

  const vapid = JSON.parse(meta.vapid);
  return {
    cronSecret: meta.cron_secret,
    vapidPublic: vapid.publicKey,
    vapidPrivate: vapid.privateKey,
  };
}

let pending = null;

/** 실패하면 기억하지 않습니다 — 잠깐 끊긴 DB 때문에 인스턴스가 통째로 멈추지 않게. */
export function keys() {
  if (!pending) pending = load().catch((e) => { pending = null; throw e; });
  return pending;
}

/** 테스트에서 새 인스턴스인 척할 때만 씁니다. */
export function forgetKeys() {
  pending = null;
}
