import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 인증 리디렉트 착지점. 두 형식을 모두 받는다.
// - 소셜 로그인(PKCE): ?code=...        → exchangeCodeForSession
// - 이메일 확인 링크:  ?token_hash&type → verifyOtp
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // 리버스 프록시(caddy) 뒤에서는 origin 이 내부 주소라 원래 호스트로 돌려보낸다
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base =
    forwardedHost && process.env.NODE_ENV === "production" ? `https://${forwardedHost}` : origin;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Supabase 가 링크 만료·재사용 등을 error 쿼리로 붙여 보낸다
  const linkError = searchParams.get("error_description") ?? searchParams.get("error");

  if (!linkError) {
    const supabase = await createClient();
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (!error) return NextResponse.redirect(base);
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(base);
    }
  }

  // 이메일 인증 실패와 소셜 로그인 실패를 구분해서 알린다
  const kind = tokenHash || type ? "email" : "oauth";
  return NextResponse.redirect(`${base}/?auth_error=${kind}`);
}
