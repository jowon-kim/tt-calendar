import { requireSession, body, guard, methodNotAllowed, normalizeEvent } from '../../lib/http.js';
import { findEvent, updateEvent, removeEvent } from '../../lib/store.js';
import { notify } from '../../lib/push.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* 다른 달력의 일정 id를 알아도 "없는 일정"과 똑같이 404입니다 — 있다는 사실도 흘리지 않게. */
export default guard(async (req, res) => {
  if (!['PATCH', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['PATCH', 'DELETE']);
  const session = await requireSession(req, res);
  if (!session) return;
  const { coupleId, slot } = session;

  const { id } = req.query;
  if (!UUID.test(String(id || ''))) return res.status(404).json({ error: 'error.noSuchEvent' });

  if (req.method === 'DELETE') {
    const gone = await removeEvent(coupleId, id);
    if (!gone) return res.status(404).json({ error: 'error.noSuchEvent' });
    await notify(coupleId, 'push.deletedEvent', gone, slot);
    return res.status(204).end();
  }

  const existing = await findEvent(coupleId, id);
  if (!existing) return res.status(404).json({ error: 'error.noSuchEvent' });

  const updated = await updateEvent(coupleId, id, normalizeEvent(body(req), existing));
  await notify(coupleId, 'push.editedEvent', updated, slot);
  res.status(200).json(updated);
});
