import { requireSession, body, guard, methodNotAllowed, normalizeSettings } from '../lib/http.js';
import { patchSettings } from '../lib/store.js';

/**
 * PATCH 보낸 칸만 바꾸기
 *
 * 설정 값 자체는 /api/state가 달력과 같이 내려줍니다.
 * (예전 GET은 바깥 시계 열쇠를 알려줬습니다. 여러 커플이 쓰면 그 열쇠 하나로 모든
 * 커플의 알림을 두드릴 수 있어서, 이제 운영하는 사람만 압니다 — lib/http.js requireCron.)
 */
export default guard(async (req, res) => {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
  const session = await requireSession(req, res);
  if (!session) return;

  res.status(200).json(await patchSettings(session.coupleId, normalizeSettings(body(req))));
});
