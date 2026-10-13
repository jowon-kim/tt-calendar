import { ready, body, guard, methodNotAllowed, setSessionCookie, deviceName, ValidationError, clientIp } from '../../lib/http.js';
import { canGoogle, clientIds, verifyIdToken } from '../../lib/google.js';
import {
  findUserByGoogle, signUpAlone, signUpInvited, createSession, mayCreateAccount, recordSignup,
} from '../../lib/accounts.js';

/**
 * GET  구글로 들어오기를 켰는지, 켰으면 화면이 쓸 클라이언트 ID. 안 켰으면 404 — 화면은 버튼을 숨깁니다
 * POST { credential, invite? } 구글이 준 ID 토큰으로 들어오기. 처음 보는 구글 계정이면 그 자리에서
 *      가입합니다 (초대 링크로 왔으면 그 달력에 바로 앉아요). created로 어느 쪽이었는지 알려줍니다 —
 *      이미 있던 사람이 초대 링크로 왔으면 화면이 이어서 초대를 받습니다.
 *
 * 아이디로 가입한 계정과는 이어 붙이지 않습니다. 아이디 계정엔 이메일이 없어서 같은 사람인지 알 길이 없어요.
 */
export default guard(async (req, res) => {
  const allowed = ['GET', 'POST'];
  if (!allowed.includes(req.method)) return methodNotAllowed(res, allowed);
  if (!canGoogle()) return res.status(404).json({ error: 'error.googleOff' });
  if (req.method === 'GET') return res.status(200).json({ clientId: clientIds()[0] });
  if (!(await ready(res))) return;

  const input = body(req);
  const person = await verifyIdToken(input.credential);
  if (!person) throw new ValidationError('error.googleFailed');

  const signIn = async (userId, created) => {
    setSessionCookie(res, await createSession(userId, deviceName(req)));
    res.status(created ? 201 : 200).json({ ok: true, created });
  };

  const known = await findUserByGoogle(person.sub);
  if (known) return signIn(known.id, false);

  // 이미 있는 사람의 로그인은 막지 않고, 새 계정을 만들 때만 셉니다
  const ip = clientIp(req);
  if (!(await mayCreateAccount(ip))) return res.status(429).json({ error: 'error.tooManySignups' });

  const invite = typeof input.invite === 'string' ? input.invite.trim() : '';
  const google = { googleSub: person.sub, email: person.email };
  const made = invite ? await signUpInvited(google, invite) : await signUpAlone(google);

  if (made === 'invalid') throw new ValidationError('error.badInvite');
  if (!made || made === 'taken') {
    // 같은 구글 계정으로 두 번 눌러 거의 동시에 가입하려 했습니다 — 먼저 된 쪽으로 들어갑니다
    const first = await findUserByGoogle(person.sub);
    if (!first) throw new ValidationError('error.googleFailed');
    return signIn(first.id, false);
  }
  await recordSignup(ip);
  return signIn(made.userId, true);
});
