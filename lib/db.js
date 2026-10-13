import { neon } from '@neondatabase/serverless';

let client = null;

const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;

/** Neon을 붙이지 않고 배포하면 여기서 걸립니다. 로그인 화면이 그 사실을 알려줘요. */
export const hasDatabase = () => !!databaseUrl();

function connect() {
  if (!client) {
    const url = databaseUrl();
    if (!url) throw new Error('DATABASE_URL 환경변수가 없습니다');
    client = neon(url);
  }
  return client;
}

/**
 * 태그드 템플릿으로 씁니다:  sql`select * from events where id = ${id}`
 * 첫 호출 때만 연결을 만듭니다. Neon은 HTTP 드라이버라 연결 유지 비용이 없습니다.
 */
export function sql(...args) {
  return connect()(...args);
}

/** 값이 끼지 않는 문장 하나를 그대로 돌립니다. schema.sql을 돌릴 때만 씁니다. */
export function run(text) {
  return connect().query(text);
}

/** 테스트에서 가짜 클라이언트를 끼워 넣을 때만 씁니다. run을 쓰려면 .query도 달아주세요. */
export function useClient(fn) {
  client = fn;
}
