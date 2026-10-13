import { requireSession, body, guard, methodNotAllowed, ValidationError } from '../../lib/http.js';
import { savePushSub, removePushSub } from '../../lib/store.js';
import { publicKey } from '../../lib/push.js';

const ENDPOINT_LIMIT = 500; // 실제로는 300자 안팎입니다 — 터무니없는 건 받지 않습니다
const FCM_TOKEN = /^[A-Za-z0-9_:.-]{20,4096}$/; // FCM 토큰은 150자 안팎의 이 글자들입니다

/**
 * GET    이 앱의 공개키 — 브라우저가 구독을 만들 때 필요합니다
 * POST   이 기기로 알림 받기 (같은 기기가 다시 켜면 덮어씁니다)
 *        브라우저는 { subscription }, 스토어 앱은 { platform, token }
 * DELETE 이 기기만 끄기 — 같은 사람의 다른 기기는 그대로 둡니다
 *
 * 알림을 받을 사람(a/b)은 로그인한 계정이 정합니다. 예전엔 화면이 보낸 owner를
 * 믿었는데, 그러면 상대 이름으로 기기를 걸어 상대 몫의 알림을 가로챌 수 있습니다.
 */
export default guard(async (req, res) => {
  const allowed = ['GET', 'POST', 'DELETE'];
  if (!allowed.includes(req.method)) return methodNotAllowed(res, allowed);
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'GET') return res.status(200).json({ publicKey: await publicKey() });

  if (req.method === 'DELETE') {
    const endpoint = String(req.query.endpoint || '');
    if (!endpoint) throw new ValidationError('error.noDevice');
    await removePushSub(session.coupleId, endpoint);
    return res.status(204).end();
  }

  const input = body(req);

  /* 스토어 앱: { platform: 'ios' | 'android', token } — FCM이 준 토큰 하나면 됩니다 */
  if (input.platform === 'ios' || input.platform === 'android') {
    const token = input.token;
    if (typeof token !== 'string' || !FCM_TOKEN.test(token)) throw new ValidationError('error.pushFailed');
    await savePushSub(session.coupleId, session.slot, { endpoint: token }, input.platform, session.sessionId);
    return res.status(201).json({ ok: true });
  }

  const { subscription } = input;
  const endpoint = subscription?.endpoint;
  const { p256dh, auth } = subscription?.keys || {};
  const ok =
    typeof endpoint === 'string' &&
    endpoint.startsWith('https://') &&
    endpoint.length <= ENDPOINT_LIMIT &&
    typeof p256dh === 'string' && p256dh &&
    typeof auth === 'string' && auth;
  if (!ok) throw new ValidationError('error.pushFailed');

  await savePushSub(session.coupleId, session.slot, { endpoint, p256dh, auth }, 'web', session.sessionId);
  res.status(201).json({ ok: true });
});
