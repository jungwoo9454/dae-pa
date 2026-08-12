import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "대파 — 대용량 파티원",
  description: "공구 등록부터 정산까지 한 번에 끝내는 동네 공동구매 플랫폼",
  // 파비콘은 app/icon.svg 를 Next.js 가 자동으로 잡는다 (#64)
  openGraph: {
    title: "대파 — 대용량 파티원",
    description: "공구 등록부터 정산까지 한 번에 끝내는 동네 공동구매 플랫폼",
    images: ["/logo-mark.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet" />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
