import crypto from 'node:crypto';
import { requireSession, body, guard, methodNotAllowed, ValidationError } from '../../lib/http.js';
import { insertPhoto, countPhotos } from '../../lib/store.js';
import { hasBlob, photoPath, putPhoto, deletePhotos } from '../../lib/blob.js';
import '../../public/limits.js';

const ALLOWED = ['image/webp', 'image/jpeg', 'image/png'];
const { photos, photoBytes, diaryPhotos, diaryPhotoBytes } = globalThis.DIARY_LIMITS;

export default guard(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const session = await requireSession(req, res);
  if (!session) return;
  const { coupleId } = session;

  const { mime, data, purpose: asked } = body(req);
  // "우리" 탭 일기 사진은 달력 사진 목록에 안 섞이고 한도도 따로입니다
  const purpose = asked === 'diary' ? 'diary' : 'calendar';
  const [MAX_PHOTOS, MAX_BYTES] = purpose === 'diary' ? [diaryPhotos, diaryPhotoBytes] : [photos, photoBytes];
  if (!ALLOWED.includes(mime)) throw new ValidationError('error.imageOnly');
  if (typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new ValidationError('error.photoRead');
  }
  if (Buffer.byteLength(data, 'base64') > MAX_BYTES) throw new ValidationError('error.photoTooBig');
  if (await countPhotos(coupleId, purpose) >= MAX_PHOTOS) {
    throw new ValidationError('error.photoLimit');
  }

  const id = crypto.randomUUID();
  if (!hasBlob()) {
    await insertPhoto(coupleId, id, mime, { data, purpose });
    return res.status(201).json({ id });
  }

  /* Blob에 먼저 올리고 줄을 적습니다. 줄을 먼저 적으면 올리다 실패했을 때 달력에
     깨진 사진 자리가 남아요. 반대로 줄 적기가 실패하면 올린 사진을 도로 지웁니다. */
  const blobPath = photoPath(coupleId, id);
  await putPhoto(blobPath, Buffer.from(data, 'base64'), mime);
  try {
    await insertPhoto(coupleId, id, mime, { blobPath, purpose });
  } catch (e) {
    await deletePhotos([blobPath]).catch(() => {});
    throw e;
  }
  res.status(201).json({ id });
});
