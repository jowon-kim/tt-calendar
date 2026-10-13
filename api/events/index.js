import { requireSession, body, guard, methodNotAllowed, normalizeEvent } from '../../lib/http.js';
import { insertEvent } from '../../lib/store.js';
import { notify } from '../../lib/push.js';

export default guard(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const session = await requireSession(req, res);
  if (!session) return;

  const event = await insertEvent(session.coupleId, normalizeEvent(body(req)));
  // 응답을 보낸 뒤에 보내면 함수가 먼저 죽어서 요청이 잘립니다 — 여기서 기다립니다
  await notify(session.coupleId, 'push.newEvent', event, session.slot);
  res.status(201).json(event);
});
