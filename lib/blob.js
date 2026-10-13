/**
 * 달력 사진을 DB 밖(Vercel Blob)에 둡니다.
 *
 * 예전엔 base64 글자로 Postgres에 넣었습니다. 한 쌍이면 30장에 400KB라 괜찮지만,
 * 커플이 천이면 DB가 사진 창고가 되고 백업·복제 비용을 통째로 갉아먹습니다.
 *
 * - 사진은 private으로 올립니다. Blob 주소를 알아도 토큰 없이는 못 열어요.
 *   브라우저는 이 주소를 모르고, 늘 /api/photos/{id}가 로그인과 커플을 확인한 뒤 건네줍니다
 * - BLOB_READ_WRITE_TOKEN이 없으면(로컬 개발, Blob 없이 직접 설치) 예전처럼 DB에 담습니다.
 *   이미 DB에 들어간 사진도 그대로 읽힙니다 — 사진마다 어디 있는지를 줄에 적어두니까요
 */

/* 테스트에서는 useBlob으로 가짜를 끼웁니다 (lib/push.js의 useSender와 같은 방식). */
let client = null;

export function useBlob(fake) {
  client = fake;
}

export const hasBlob = () => !!client || !!process.env.BLOB_READ_WRITE_TOKEN;

async function vercel() {
  const blob = await import('@vercel/blob');
  return {
    async put(path, bytes, mime) {
      await blob.put(path, bytes, { access: 'private', contentType: mime, addRandomSuffix: false });
    },
    async get(path) {
      const found = await blob.get(path, { access: 'private' });
      if (!found || found.statusCode !== 200) return null;
      return Buffer.from(await new Response(found.stream).arrayBuffer());
    },
    async del(paths) {
      if (paths.length) await blob.del(paths);
    },
  };
}

async function store() {
  client ??= await vercel();
  return client;
}

/** 사진 한 장의 자리. 커플별 폴더라, 나중에 한 커플을 통째로 지우기 쉽습니다. */
export const photoPath = (coupleId, id) => `photos/${coupleId}/${id}`;

export const putPhoto = async (path, bytes, mime) => (await store()).put(path, bytes, mime);
export const getPhoto = async (path) => (await store()).get(path);
export const deletePhotos = async (paths) => (await store()).del(paths);
