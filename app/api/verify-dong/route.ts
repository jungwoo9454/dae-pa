// GET /api/verify-dong — 요청 IP 로 동네를 추정한다 (#83).
//
// GeoIP 는 동(洞) 단위 정확도가 안 나온다. 그래서 시/구까지만 자동으로 잡아서 내려주고,
// 실제 저장할 동네 이름은 화면에서 사용자가 확정한다.
export const runtime = "nodejs";

/** 개발용 폴백 — 로컬·사설 IP 는 GeoIP 로 판정할 수 없다 */
const FALLBACK_DONG = "역삼동";

/** x-forwarded-for 는 "client, proxy1, proxy2" 형태 — 맨 앞이 클라이언트다 */
function clientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "";
}

function isPrivate(ip: string) {
  if (!ip || ip === "::1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^(fc|fd)/i.test(ip)) return true; // IPv6 ULA
  return false;
}

export async function GET(req: Request) {
  const ip = clientIp(req);
  if (isPrivate(ip)) {
    return Response.json({ dong: FALLBACK_DONG, detail: "로컬 환경 — 개발용 기본값", fallback: true });
  }
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      // 데모 중 응답이 늦으면 인증 박스가 멈춘 것처럼 보인다 — 3초에서 끊고 폴백으로 간다
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const g = (await res.json()) as { city?: string; region?: string; error?: boolean };
    if (!res.ok || g.error || !g.city) throw new Error("geoip lookup failed");
    return Response.json({
      dong: g.city,
      detail: [g.region, g.city].filter(Boolean).join(" · "),
      fallback: false,
    });
  } catch {
    return Response.json({ dong: FALLBACK_DONG, detail: "위치를 확인하지 못했어요", fallback: true });
  }
}
