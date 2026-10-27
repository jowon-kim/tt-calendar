import { requireSession, body, guard, methodNotAllowed, normalizeSettings, ValidationError } from '../lib/http.js';
import { patchSettings, getSettings, ownsIcon, dropOtherIcons } from '../lib/store.js';
import { deletePhotos } from '../lib/blob.js';
import { notifyJoined } from '../lib/push.js';

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

  const patch = normalizeSettings(body(req));
  // 홈 화면 아이콘은 이 커플이 아이콘으로 올린 사진만 — 남의 사진 id 를 걸 수 없게
  if (patch.icon && !(await ownsIcon(session.coupleId, patch.icon))) throw new ValidationError('error.noSuchPhoto');
  // 내 이름이 비어 있다가 처음 생기는 때 = 초대로 막 들어와 "뭐라고 불러 드릴까요?"에 답한 때
  const naming = !!patch.names?.[session.slot];
  const before = naming ? await getSettings(session.coupleId) : null;
  const saved = await patchSettings(session.coupleId, patch);
  if (naming && !before.names?.[session.slot]) await notifyJoined(session.coupleId, session.slot, saved);
  if ('icon' in patch) {
    const gone = await dropOtherIcons(session.coupleId, patch.icon);
    if (gone.length) await deletePhotos(gone).catch((e) => console.error('could not delete old icon files', e.message));
  }
  res.status(200).json(saved);
});
