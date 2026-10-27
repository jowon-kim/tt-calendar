import { requireSession, guard, methodNotAllowed } from '../../lib/http.js';
import { findPhoto, removePhoto, findIcon } from '../../lib/store.js';
import { getPhoto, deletePhotos } from '../../lib/blob.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default guard(async (req, res) => {
  if (!['GET', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['GET', 'DELETE']);

  const { id } = req.query;

  /* 홈 화면 아이콘만은 로그인 없이 — 폰이 홈 화면에 깔 때 쿠키 없이 받아 가기도 해서요.
     purpose='icon' 줄만 이 길로 나옵니다. 달력·일기 사진은 아래처럼 그 달력 사람만 봅니다 */
  if (req.method === 'GET' && UUID.test(String(id || ''))) {
    const icon = await findIcon(id);
    if (icon) {
      const bytes = icon.blobPath ? await getPhoto(icon.blobPath) : Buffer.from(icon.data, 'base64');
      if (bytes) {
        res.setHeader('Content-Type', icon.mime);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).end(bytes);
      }
    }
  }

  /* <img src>로 불러가는 자리지만 로그인 쿠키가 같이 실립니다. 예전엔 헤더를 못 실어서
     주소만 알면 누구나 볼 수 있었어요. 이제 그 달력 사람만 봅니다. */
  const session = await requireSession(req, res);
  if (!session) return;

  if (!UUID.test(String(id || ''))) return res.status(404).json({ error: 'error.noSuchPhoto' });

  if (req.method === 'DELETE') {
    const gone = await removePhoto(session.coupleId, id);
    if (gone === false) return res.status(404).json({ error: 'error.noSuchPhoto' });
    // 줄은 이미 지워서 달력에서는 사라졌습니다. Blob 쪽이 실패하면 주인 없는 파일이 남을 뿐이라 기록만
    if (gone) await deletePhotos([gone]).catch((e) => console.error('could not delete the photo file', e.message));
    return res.status(204).end();
  }

  const photo = await findPhoto(session.coupleId, id);
  if (!photo) return res.status(404).json({ error: 'error.noSuchPhoto' });

  const bytes = photo.blobPath ? await getPhoto(photo.blobPath) : Buffer.from(photo.data, 'base64');
  if (!bytes) return res.status(404).json({ error: 'error.noSuchPhoto' });

  /* 사진은 절대 안 바뀌고 지우면 주소째 사라지니 오래 캐시해도 됩니다.
     다만 private — 브라우저만 들고 있고, 중간의 공유 캐시가 남에게 건네지 않게. */
  res.setHeader('Content-Type', photo.mime);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.status(200).end(bytes);
});
