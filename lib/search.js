/**
 * 지도 검색 (10/31) — 이름으로 장소를 찾습니다.
 *
 * KAKAO_REST_KEY 가 있으면 카카오 장소 검색(한국 가게·"을지로 냉면" 같은 말도 찾음)을 먼저 쓰고,
 * 없거나 실패하거나 결과가 없으면 Photon(OpenStreetMap 기반, 키 없음)으로 찾습니다.
 * 브라우저가 아니라 서버가 묻습니다 — 키를 숨기고, 바깥에는 검색어와 지도 중심만 나갑니다.
 *
 * 돌려주는 모양: [{ name, address, lat, lng, kind }]  kind = place | food | culture
 */
const LIMIT = 8;
const wait = () => AbortSignal.timeout(5000);

async function kakao(q, near, key) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', q);
  url.searchParams.set('size', String(LIMIT));
  if (near) { url.searchParams.set('x', String(near.lng)); url.searchParams.set('y', String(near.lat)); }
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: wait() });
  if (!res.ok) throw new Error(`kakao ${res.status}`);
  const { documents = [] } = await res.json();
  return documents.map((d) => ({
    name: d.place_name,
    address: d.road_address_name || d.address_name || '',
    lat: Number(d.y), lng: Number(d.x),
    kind: ['FD6', 'CE7'].includes(d.category_group_code) ? 'food' : d.category_group_code === 'CT1' ? 'culture' : 'place',
  }));
}

const FOOD = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'bakery', 'ice_cream'];
const CULTURE = ['cinema', 'theatre', 'museum', 'gallery', 'arts_centre', 'library'];

async function photon(q, near) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(LIMIT));
  if (near) { url.searchParams.set('lat', String(near.lat)); url.searchParams.set('lon', String(near.lng)); }
  const res = await fetch(url, { headers: { 'User-Agent': 'couple-calendar-map-search' }, signal: wait() });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const { features = [] } = await res.json();
  return features.filter((f) => f.properties?.name).map(({ properties: p, geometry }) => ({
    name: p.name,
    address: [p.city, p.district, p.street, p.housenumber].filter(Boolean).join(' '),
    lat: geometry.coordinates[1], lng: geometry.coordinates[0],
    kind: FOOD.includes(p.osm_value) ? 'food' : CULTURE.includes(p.osm_value) ? 'culture' : 'place',
  }));
}

/** OpenStreetMap 에는 같은 가게가 건물·입구로 여러 번 있습니다 — 같은 이름에 100m 안쪽이면 하나만 */
function once(places) {
  const seen = new Set();
  return places.filter((p) => {
    const key = `${p.name.replace(/\(.*\)/, '').trim()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchPlaces(q, near) {
  const key = process.env.KAKAO_REST_KEY;
  if (key) {
    const found = await kakao(q, near, key).catch((e) => { console.error('map search', e.message); return []; });
    if (found.length) return once(found);
  }
  return once(await photon(q, near));
}
