import { ready, body, guard, methodNotAllowed, setSessionCookie, deviceName } from '../../lib/http.js';
import { checkPassword, cleanLogin, wasteTime, passwordSignIn } from '../../lib/auth.js';
import {
  findUserByLogin, createSession, recentFailures, recordFailure, clearFailures,
} from '../../lib/accounts.js';

const MAX_FAILURES = 10; // 15분 동안 (lib/accounts.js recentFailures)

const slowDown = () => new Promise((r) => setTimeout(r, 400)); // 무차별 대입 완화

/**
 * POST { username, password }
 *
 * 없는 아이디와 틀린 비밀번호는 같은 답을 돌려줍니다 — 어느 아이디가 가입했는지
 * 여기서 알아낼 수 없게. 걸리는 시간도 같게 맞춥니다 (lib/auth.js wasteTime).
 */
export default guard(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  // 구글 하나로 들어옵니다 (lib/auth.js passwordSignIn). 옛 화면이 부르면 왜 안 되는지 알려줘요
  if (!passwordSignIn()) return res.status(410).json({ error: 'error.googleOnly' });
  if (!(await ready(res))) return;

  const input = body(req);
  const login = cleanLogin(input.username);
  const password = String(input.password || '');

  if (login && (await recentFailures(login)) >= MAX_FAILURES) {
    return res.status(429).json({ error: 'error.tooManyTries' });
  }

  const user = login ? await findUserByLogin(login) : null;
  const right = user ? await checkPassword(password, user.passwordHash) : (await wasteTime(password), false);

  if (!right) {
    if (login) await recordFailure(login);
    await slowDown();
    return res.status(401).json({ error: 'error.wrongLogin' });
  }

  await clearFailures(login);
  setSessionCookie(res, await createSession(user.id, deviceName(req)));
  res.status(200).json({ ok: true });
});
