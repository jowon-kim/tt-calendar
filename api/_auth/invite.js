import { requireSession, body, guard, methodNotAllowed, ValidationError } from '../../lib/http.js';
import { createInvite, joinByInvite } from '../../lib/accounts.js';

/**
 * POST 상대를 부를 새 코드. 예전 링크는 죽습니다. 링크 주소는 화면이 만듭니다
 *      (앱이 열린 주소 그대로라, 네이티브 앱 안에서도 맞는 주소가 나옵니다)
 * PUT  { code } 이미 가입한 사람이 초대를 받아 상대 달력으로 옮겨갑니다
 */
export default guard(async (req, res) => {
  const allowed = ['POST', 'PUT'];
  if (!allowed.includes(req.method)) return methodNotAllowed(res, allowed);
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const code = await createInvite(session.coupleId);
    if (!code) return res.status(409).json({ error: 'error.alreadyPaired' });
    return res.status(201).json({ code });
  }

  const code = String(body(req).code || '').trim();
  if (!code) throw new ValidationError('error.badInvite');

  const result = await joinByInvite(session, code);
  if (result === 'paired') return res.status(409).json({ error: 'error.alreadyPaired' });
  if (result === 'hasData') return res.status(409).json({ error: 'error.hasOwnCalendar' });
  if (result === 'invalid') throw new ValidationError('error.badInvite');
  res.status(200).json({ ok: true });
});
