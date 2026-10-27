import { requireSession, body, guard, methodNotAllowed, ValidationError } from '../lib/http.js';
import { sql } from '../lib/db.js';
import { getSettings, removePhoto } from '../lib/store.js';
import { deletePhotos } from '../lib/blob.js';
import { notifyAll } from '../lib/push.js';
import { questionFor } from '../lib/questions.js';

/**
 * "우리" 탭 (10/27) — 버킷리스트·가계부·맛집·문화·일기·장소, 오늘의 질문, 콕 찌르기, 위치 공유를 함수 하나로.
 * (Vercel 무료 플랜은 함수 12개까지 — test.mjs 가 센다. 그래서 종류마다 파일을 만들지 않습니다.)
 *
 *   GET                         → { items, question, location, nudgesLeft }
 *   POST   { action: 'item', kind, title, memo, done, amount, day, lat, lng, photoId }
 *   PATCH  { action: 'item', id, ...바꿀 칸 }
 *   DELETE ?id=                 → 그 항목
 *   POST   { action: 'answer', text }          오늘 질문에 답 — 둘 다 답해야 상대 답이 보입니다
 *   POST   { action: 'nudge' }                 상대 폰에 "콕" — 24시간에 3번까지
 *   POST   { action: 'location', on, lat, lng } 위치 공유 — 둘 다 켜야 서로 보이고, 끄면 지웁니다
 *
 * 모든 쿼리는 couple_id 로 거릅니다 (test.mjs 두 커플 구간이 새는지 봅니다).
 */
const KINDS = ['bucket', 'ledger', 'food', 'culture', 'diary', 'place'];
const NUDGE_LIMIT = 3;
const other = (slot) => (slot === 'a' ? 'b' : 'a');

/** 그 커플 시간대의 오늘 'YYYY-MM-DD' */
function today(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function cleanItem(input, partial = false) {
  const out = {};
  if (!partial || 'kind' in input) {
    if (!KINDS.includes(input.kind)) throw new ValidationError('error.badKind');
    out.kind = input.kind;
  }
  const text = (k, max) => { if (k in input) out[k] = String(input[k] ?? '').trim().slice(0, max); };
  text('title', 120);
  text('memo', 2000);
  if ('done' in input) out.done = !!input.done;
  if ('amount' in input) out.amount = input.amount === null || input.amount === '' ? null : Math.round(Number(input.amount)) || 0;
  if ('day' in input) {
    if (input.day && !/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw new ValidationError('error.badDate');
    out.day = input.day || null;
  }
  for (const k of ['lat', 'lng']) {
    if (!(k in input)) continue;
    const v = input[k] === null || input[k] === '' ? null : Number(input[k]);
    if (v !== null && (!Number.isFinite(v) || Math.abs(v) > (k === 'lat' ? 90 : 180))) throw new ValidationError('error.badPlace');
    out[k] = v;
  }
  if ('photoId' in input) out.photoId = input.photoId || null;
  if (!partial && !out.title && out.kind !== 'diary') throw new ValidationError('error.titleRequired');
  return out;
}

async function listItems(coupleId) {
  return sql`
    select id, kind, title, memo, done, amount, to_char(day, 'YYYY-MM-DD') as day, lat, lng,
           photo_id as "photoId", member, created_at as "createdAt"
    from items where couple_id = ${coupleId}
    order by day desc nulls last, created_at desc`;
}

async function question(coupleId, slot, day, locale) {
  const rows = await sql`select member, text from answers where couple_id = ${coupleId} and qday = ${day}`;
  const mine = rows.find((r) => r.member === slot)?.text ?? null;
  const theirs = rows.find((r) => r.member === other(slot))?.text ?? null;
  // 내가 답하기 전엔 상대 답을 내려보내지 않습니다 — 화면에서 가리는 게 아니라 아예 안 보냅니다
  return { day, text: questionFor(day, locale), mine, theirs: mine === null ? null : theirs, theyAnswered: theirs !== null };
}

async function location(coupleId, slot) {
  const rows = await sql`select member, lat, lng, at from locations where couple_id = ${coupleId}`;
  const me = rows.find((r) => r.member === slot) || null;
  const them = rows.find((r) => r.member === other(slot)) || null;
  // 둘 다 켰을 때만 상대 위치를 보냅니다
  return { on: !!me, me, them: me && them ? them : null, theyOn: !!them };
}

async function nudgesLeft(coupleId, slot) {
  const [{ n }] = await sql`select count(*)::int as n from nudges where couple_id = ${coupleId} and member = ${slot} and at > now() - interval '24 hours'`;
  return Math.max(0, NUDGE_LIMIT - n);
}

export default guard(async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const { coupleId, slot } = session;
  const settings = await getSettings(coupleId);
  const day = today(settings.timezone);
  const state = async () => ({
    items: await listItems(coupleId),
    question: await question(coupleId, slot, day, settings.locale),
    location: await location(coupleId, slot),
    nudgesLeft: await nudgesLeft(coupleId, slot),
  });

  if (req.method === 'GET') return res.status(200).json(await state());

  if (req.method === 'DELETE') {
    const id = req.query?.id || new URL(req.url, 'http://x').searchParams.get('id');
    const gone = await sql`delete from items where couple_id = ${coupleId} and id = ${id} returning photo_id as "photoId"`;
    // 일기에 붙은 사진도 같이 — 남겨 두면 어디서도 안 보이는 사진이 한도만 먹습니다
    const photoId = gone[0]?.photoId;
    const blobPath = photoId ? await removePhoto(coupleId, photoId) : false;
    if (blobPath) await deletePhotos([blobPath]).catch((e) => console.error('could not delete the photo file', e.message));
    return res.status(200).json(await state());
  }

  const input = body(req);
  if (req.method === 'PATCH' && input.action === 'item') {
    const p = cleanItem(input, true);
    const [row] = await sql`select id from items where couple_id = ${coupleId} and id = ${input.id}`;
    if (!row) return res.status(404).json({ error: 'error.notFound' });
    await sql`update items set
      title = coalesce(${p.title ?? null}, title), memo = coalesce(${p.memo ?? null}, memo),
      done = coalesce(${p.done ?? null}, done),
      amount = case when ${'amount' in p} then ${p.amount ?? null}::int else amount end,
      day = case when ${'day' in p} then ${p.day ?? null}::date else day end,
      lat = case when ${'lat' in p} then ${p.lat ?? null}::float8 else lat end,
      lng = case when ${'lng' in p} then ${p.lng ?? null}::float8 else lng end,
      photo_id = case when ${'photoId' in p} then ${p.photoId ?? null}::uuid else photo_id end
      where couple_id = ${coupleId} and id = ${input.id}`;
    return res.status(200).json(await state());
  }
  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);

  if (input.action === 'item') {
    const p = cleanItem(input);
    await sql`insert into items (couple_id, kind, title, memo, done, amount, day, lat, lng, photo_id, member)
      values (${coupleId}, ${p.kind}, ${p.title ?? ''}, ${p.memo ?? ''}, ${p.done ?? false}, ${p.amount ?? null},
              ${p.day ?? null}, ${p.lat ?? null}, ${p.lng ?? null}, ${p.photoId ?? null}, ${slot})`;
    return res.status(201).json(await state());
  }
  if (input.action === 'answer') {
    const text = String(input.text ?? '').trim().slice(0, 1000);
    if (!text) throw new ValidationError('error.answerRequired');
    await sql`insert into answers (couple_id, qday, member, text) values (${coupleId}, ${day}, ${slot}, ${text})
      on conflict (couple_id, qday, member) do update set text = excluded.text`;
    const s = await state();
    if (!s.question.theyAnswered) {
      const name = settings.names?.[slot] || '';
      await notifyAll(coupleId, { title: '💬', body: `${name} ✓ ${s.question.text}` }, `answer-${day}`, { except: slot });
    }
    return res.status(200).json(s);
  }
  if (input.action === 'nudge') {
    if ((await nudgesLeft(coupleId, slot)) <= 0) return res.status(429).json({ error: 'error.nudgeLimit' });
    await sql`insert into nudges (couple_id, member) values (${coupleId}, ${slot})`;
    const name = settings.names?.[slot] || '';
    await notifyAll(coupleId, { title: '💗', body: `${name} 👉` }, 'nudge', { except: slot });
    return res.status(200).json(await state());
  }
  if (input.action === 'location') {
    if (!input.on) {
      await sql`delete from locations where couple_id = ${coupleId} and member = ${slot}`;
    } else {
      const p = cleanItem({ kind: 'place', title: 'x', lat: input.lat, lng: input.lng }, true);
      if (p.lat == null || p.lng == null) throw new ValidationError('error.badPlace');
      await sql`insert into locations (couple_id, member, lat, lng, at) values (${coupleId}, ${slot}, ${p.lat}, ${p.lng}, now())
        on conflict (couple_id, member) do update set lat = excluded.lat, lng = excluded.lng, at = now()`;
    }
    return res.status(200).json(await state());
  }
  throw new ValidationError('error.badAction');
});
