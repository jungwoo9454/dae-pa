// POST /api/upload — 이미지 파일 하나를 받아 webp 로 변환해 R2 에 넣고 공개 URL 을 돌려준다.
//
// 변환을 서버에서 하는 이유: 서버가 원본 바이트를 봐야 "정말 이미지인지" 를 판정할 수 있다.
// presigned URL 로 클라이언트가 R2 에 직접 올리면 그 검증 지점이 사라진다.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/server/r2";

/** 업로드 종류 = R2 키 prefix. 화이트리스트로만 받는다 — 임의 문자열이면 경로 주입이 된다. */
const KINDS = ["receipts", "avatars", "deals", "chat"] as const;
export type UploadKind = (typeof KINDS)[number];

const MAX_BYTES = 10 * 1024 * 1024;

// sharp 가 열 수 있는 포맷 중 "이미지" 로 인정할 것들. svg 는 뺀다 — 외부 참조가 들어간
// SVG 를 래스터화하면 서버가 그 URL 을 대신 긁어오는 SSRF 가 된다.
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

    const form = await req.formData();
    const kind = String(form.get("kind") ?? "");
    if (!(KINDS as readonly string[]).includes(kind)) {
      return Response.json({ error: "잘못된 업로드 종류입니다" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "파일이 없습니다" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "10MB 이하 이미지만 올릴 수 있어요" }, { status: 413 });
    }

    const input = Buffer.from(await file.arrayBuffer());

    // 신뢰 경계 — Content-Type 헤더와 확장자는 클라이언트가 정한 값이라 못 믿는다.
    // 실제로 열어보는 sharp 가 유일한 판정자다 (magic byte 를 따로 스니핑하면 판정이 갈린다).
    // limitInputPixels 는 디컴프레션 폭탄 방어 — 작은 파일이 수십억 픽셀로 펴지는 것을 막는다.
    //
    // 이 블록의 실패는 "보낸 게 이미지가 아니다" 즉 클라이언트 잘못이라 400 이다.
    // R2 업로드 실패(자격증명 누락·네트워크)는 서버 잘못이라 바깥 catch 에서 500 으로 나간다.
    let webp: Buffer;
    try {
      const image = sharp(input, { limitInputPixels: 50_000_000 });
      const meta = await image.metadata();
      if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
        return Response.json({ error: "이미지 파일만 올릴 수 있어요" }, { status: 400 });
      }
      webp = await image
        .rotate() // EXIF Orientation 반영 — 안 하면 iOS 세로 사진이 눕는다
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (error) {
      console.error("[POST /api/upload] 이미지 디코드 실패", error);
      return Response.json({ error: "이미지 파일만 올릴 수 있어요" }, { status: 400 });
    }

    // 키에 UUID 를 쓰는 이유: 아래 immutable 캐시 때문에 같은 키를 덮어쓰면 브라우저가
    // 옛 이미지를 계속 보여준다 (아바타를 바꿔도 반영이 안 됨).
    const key = `${kind}/${crypto.randomUUID()}.webp`;

    await r2().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET(),
        Key: key,
        Body: webp,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return Response.json({ url: `${R2_PUBLIC_URL()}/${key}` }, { status: 201 });
  } catch (error) {
    // 여기까지 온 건 R2 업로드나 환경 변수 문제 — 클라이언트가 고칠 수 없는 서버 잘못이다.
    console.error("[POST /api/upload]", error);
    return Response.json({ error: "업로드에 실패했어요" }, { status: 500 });
  }
}
