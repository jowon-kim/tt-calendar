import {
  requireSession, body, guard, methodNotAllowed, clearSessionCookie, sessionToken, ValidationError,
} from '../../lib/http.js';
import { checkPassword, hashPassword, goodPassword } from '../../lib/auth.js';
import { verifyIdToken } from '../../lib/google.js';
import {
  proofsOf, deleteAccount, changePassword, recentFailures, recordFailure, clearFailures,
} from '../../lib/accounts.js';
import { deletePhotos } from '../../lib/blob.js';

const MAX_FAILURES = 10; // 로그인과 같은 셈 — 여기서 지금 비밀번호를 맞춰보는 것도 한 번의 시도입니다

/**
 * 계정 창구.
 *
 * PATCH { current, password }
 *        비밀번호 바꾸기. 이메일을 안 받아서 잊으면 되찾을 수 없으니, 기억날 때 바꿀 수는
 *        있어야 합니다. 바꾸면 이 기기 말고 다른 곳의 로그인은 끊겨요.
 *        구글로만 들어온 사람은 바꿀 비밀번호가 없어서 화면에 버튼이 안 보입니다
 *
 * DELETE { password } 또는 구글로 들어온 사람은 { credential }
 *        나가는 문. 앱스토어는 앱 안에서 가입할 수 있으면 앱 안에서 탈퇴도 되어야 한다고
 *        요구합니다 (5.1.1(v)). 본인인지 한 번 더 묻습니다 — 잠깐 폰을 빌린 사람이
 *        누른 한 번에 둘의 기록이 사라지면 안 되니까요
 */
export default guard(async (req, res) => {
  if (!['PATCH', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['PATCH', 'DELETE']);
  const session = await requireSession(req, res);
  if (!session) return;

  const input = body(req);
  const { passwordHash, googleSub } = await proofsOf(session.userId);

  if (req.method === 'PATCH') {
    // 구글로만 들어온 사람은 바꿀 비밀번호도, 시도를 셀 아이디도 없을 수 있습니다
    if (!passwordHash) return res.status(403).json({ error: 'error.wrongPassword' });
    if ((await recentFailures(session.login)) >= MAX_FAILURES) {
      return res.status(429).json({ error: 'error.tooManyTries' });
    }
    if (!(await checkPassword(String(input.current || ''), passwordHash))) {
      await recordFailure(session.login);
      return res.status(403).json({ error: 'error.wrongPassword' }); // 401이 아닌 이유는 아래 탈퇴와 같습니다
    }
    if (!goodPassword(input.password)) throw new ValidationError('error.shortPassword');

    await changePassword(session.userId, await hashPassword(input.password), sessionToken(req));
    await clearFailures(session.login);
    return res.status(204).end();
  }

  const byPassword = !!passwordHash && await checkPassword(String(input.password || ''), passwordHash);
  const byGoogle = !byPassword && !!googleSub && !!input.credential
    && (await verifyIdToken(input.credential))?.sub === googleSub;
  // 401이 아니라 403 — 화면은 401을 "로그인이 풀렸다"로 읽고 바로 로그아웃시킵니다
  if (!byPassword && !byGoogle) {
    return res.status(403).json({ error: passwordHash ? 'error.wrongPassword' : 'error.googleFailed' });
  }

  const leftovers = await deleteAccount(session);
  // 줄은 이미 다 지웠습니다. Blob 파일 지우기가 실패해도 아무도 열 수 없는 파일이 남을 뿐이라 기록만
  if (leftovers?.length) {
    await deletePhotos(leftovers).catch((e) => console.error('could not delete photo files', e.message));
  }
  clearSessionCookie(res);
  res.status(204).end();
});
