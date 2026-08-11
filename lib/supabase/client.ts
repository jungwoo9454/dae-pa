import { createBrowserClient } from "@supabase/ssr";

// 브라우저(클라이언트 컴포넌트)용. 서버에서는 ./server 를 쓴다.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // 신규 프로젝트는 publishable key, 기존 프로젝트는 legacy anon key
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
