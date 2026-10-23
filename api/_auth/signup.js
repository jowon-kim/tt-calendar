import { ready, body, guard, methodNotAllowed, setSessionCookie, deviceName, ValidationError, clientIp } from '../../lib/http.js';
import { hashPassword, cleanLogin, goodUsername, goodPassword, passwordSignIn } from '../../lib/auth.js';
import {
  signUpAlone, signUpInvited, createSession, mayCreateAccount, recordSignup,
} from '../../lib/accounts.js';

/**
 * POST { username, password, invite? }
 *
 * invite가 없으면 새 달력을 만들어 그 사람이 첫 자리(a)에 앉습니다.
 * 초대 링크로 왔으면 그 달력의 빈자리에 앉습니다. 가입하면 바로 로그인된 상태예요.
 */
export default guard(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  // 구글 하나로 들어옵니다 (lib/auth.js passwordSignIn). 옛 화면이 부르면 왜 안 되는지 알려줘요
  if (!passwordSignIn()) return res.status(410).json({ error: 'error.googleOnly' });
  if (!(await ready(res))) return;

  const input = body(req);
  const username = cleanLogin(input.username);
  if (!username || !goodUsername(username)) throw new ValidationError('error.badUsername');
  if (!goodPassword(input.password)) throw new ValidationError('error.shortPassword');

  const ip = clientIp(req);
  if (!(await mayCreateAccount(ip))) return res.status(429).json({ error: 'error.tooManySignups' });

  const passwordHash = await hashPassword(input.password);
  const invite = typeof input.invite === 'string' ? input.invite.trim() : '';

  const made = invite
    ? await signUpInvited({ username, passwordHash }, invite)
    : await signUpAlone({ username, passwordHash });

  if (made === 'invalid') throw new ValidationError('error.badInvite');
  if (!made || made === 'taken') return res.status(409).json({ error: 'error.usernameTaken' });

  await recordSignup(ip);
  setSessionCookie(res, await createSession(made.userId, deviceName(req)));
  res.status(201).json({ ok: true });
});
