import { ready, body, guard, methodNotAllowed, sessionToken, clearSessionCookie } from '../../lib/http.js';
import { findSession, endSession } from '../../lib/accounts.js';
import { removePushSub } from '../../lib/store.js';

/**
 * POST { endpoint? }
 *
 * 이 기기의 알림 주소를 같이 보내면 그 알림도 끕니다. 안 끄면 로그아웃한 폰이
 * 계속 그 달력의 알림을 받습니다 — 같이 쓰던 폰을 넘겨준 경우에 곤란하죠.
 * 이미 로그아웃된 상태여도 204를 돌려줍니다. 결과가 같으니까요.
 */
export default guard(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!(await ready(res))) return;

  const token = sessionToken(req);
  const session = await findSession(token);
  if (session) {
    const endpoint = String(body(req).endpoint || '');
    if (endpoint) await removePushSub(session.coupleId, endpoint);
    await endSession(token);
  }
  clearSessionCookie(res);
  res.status(204).end();
});
