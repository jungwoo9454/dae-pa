import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 소셜 로그인(PKCE) 리디렉트 착지점. code → 세션 쿠키 교환 후 홈으로 보낸다.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 리버스 프록시(caddy) 뒤에서는 origin 이 내부 주소라 원래 호스트로 돌려보낸다
      const forwardedHost = request.headers.get("x-forwarded-host");
      return NextResponse.redirect(
        forwardedHost && process.env.NODE_ENV === "production" ? `https://${forwardedHost}` : origin,
      );
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
