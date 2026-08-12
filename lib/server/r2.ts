// Cloudflare R2 (S3 호환 API) 클라이언트.
// ⚠️ 서버 전용 — 시크릿을 읽으므로 클라이언트 컴포넌트에서 import 금지 (app/api/**, lib/server/** 에서만).
import { S3Client } from "@aws-sdk/client-s3";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 가 설정되지 않았다 (.env.local 확인)`);
  return v;
}

let client: S3Client | null = null;

/** S3Client 싱글턴 — 라우트 핸들러가 매 요청 새로 만들지 않게 한다 */
export function r2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

export const R2_BUCKET = () => env("R2_BUCKET");
/** 버킷의 Public Development URL (https://pub-xxxx.r2.dev) — 뒤에 / 없이 */
export const R2_PUBLIC_URL = () => env("R2_PUBLIC_URL").replace(/\/+$/, "");
