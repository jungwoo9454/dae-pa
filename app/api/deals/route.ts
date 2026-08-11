// app/api/deals/route.ts

import type { Deal } from "@/lib/types";

/**
 * POST /api/deals
 * 새로운 공고를 생성합니다
 *
 * body: { title, cat, total, goal, mins, place, store_link? }
 * response: { id, title, cat, emoji, ... }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, cat, total, goal, mins, place, store_link } = body;

    // ✅ 1. 유효성 검증
    if (!title || !title.trim()) {
      return Response.json(
        { error: "제목은 필수입니다" },
        { status: 400 }
      );
    }

    const totalN = parseInt(total) || 0;
    const goalN = parseInt(goal) || 0;

    if (totalN <= 0) {
      return Response.json(
        { error: "총 금액은 0보다 커야 합니다" },
        { status: 400 }
      );
    }

    if (goalN < 2) {
      return Response.json(
        { error: "목표 인원은 2명 이상이어야 합니다" },
        { status: 400 }
      );
    }

    // ✅ 2. 배달음식 카테고리 검증
    if (cat === "배달음식" && !store_link) {
      return Response.json(
        { error: "배달음식은 가게 링크가 필수입니다" },
        { status: 400 }
      );
    }

    // ✅ 3. 새 공구 객체 생성
    // (지금은 메모리에만 저장, 팀원 D의 Supabase 연동 후 DB에 INSERT)
    const minN = parseInt(mins) || 60;
    
    const newDeal: Deal = {
      id: Date.now(), // 임시 ID (나중에 Supabase에서 받기)
      emoji: getCategoryEmoji(cat),
      title: title.trim(),
      cat,
      total: totalN,
      goal: goalN,
      joined: 1, // 주최자가 자동으로 1명 참여
      end: Date.now() + minN * 60_000,
      place: place || "채팅방에서 협의",
      host: "나", // 나중에 user_id로 변경
      status: "recruit" as const,
      me: true,
      mine: true,
    };

    // ✅ 4. 응답 반환
    return Response.json(newDeal, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deals]", error);
    return Response.json(
      { error: "공고 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deals
 * 공고 목록을 조회합니다 (나중에 구현)
 */
export async function GET() {
  // TODO: Supabase에서 공고 목록 조회
  // const { data } = await supabase.from('group_buys').select('*');
  return Response.json([]);
}

/**
 * 카테고리에 맞는 이모지 반환
 */
function getCategoryEmoji(cat: string): string {
  const emojiMap: Record<string, string> = {
    식료품: "🧅",
    배달음식: "🍗",
    생활용품: "🧻",
    대량구매: "📦",
    기타: "🎁",
  };
  return emojiMap[cat] || "🧅";
}

