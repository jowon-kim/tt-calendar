import { requireSession, guard, methodNotAllowed } from '../lib/http.js';
import { listEvents, getSettings, listPhotoIds } from '../lib/store.js';

export default guard(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const session = await requireSession(req, res);
  if (!session) return;
  const { coupleId } = session;

  // photos: 설정에서 올린 달력 사진 id (사진 자체는 /api/photos/{id})
  const [events, settings, photos] = await Promise.all([
    listEvents(coupleId), getSettings(coupleId), listPhotoIds(coupleId),
  ]);
  // me: 이 기기로 들어온 사람이 둘 중 누구인지 — 예전엔 기기에서 골랐지만 이제 계정이 정합니다
  // paired: 상대가 들어왔는지. 아직이면 화면이 초대 링크를 권합니다
  res.status(200).json({
    events, settings, photos,
    me: { slot: session.slot, login: session.login, hasPassword: session.hasPassword },
    paired: session.paired,
  });
});
