import { requireSession, body, guard, methodNotAllowed, sessionToken, ValidationError } from '../../lib/http.js';
import { listSessions, endSessionById } from '../../lib/accounts.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 로그인된 기기.
 *
 * GET    { devices: [{ id, device, seenAt, current }] } — 지금 이 기기가 맨 앞
 * DELETE { id } 그 기기를 로그아웃시킵니다. 거기서 켠 알림도 같이 꺼져요.
 *        잃어버린 폰, 빌려 쓴 컴퓨터를 비밀번호를 바꾸지 않고도 끊을 수 있게 —
 *        구글로만 들어온 사람은 바꿀 비밀번호가 없어서 이 길뿐입니다.
 *        지금 이 기기는 여기서 못 끊습니다 (설정의 로그아웃이 알림까지 정리합니다).
 */
export default guard(async (req, res) => {
  if (!['GET', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['GET', 'DELETE']);
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    return res.status(200).json({ devices: await listSessions(session.userId, sessionToken(req)) });
  }

  const id = String(body(req).id || '');
  if (!UUID.test(id)) throw new ValidationError('error.noDevice');
  // 남의 기기 번호든 이미 끊긴 번호든 같은 답 — 번호가 살아 있는지 여기서 알아낼 수 없게
  if (!(await endSessionById(session.userId, id, sessionToken(req)))) {
    return res.status(404).json({ error: 'error.noDevice' });
  }
  res.status(204).end();
});
