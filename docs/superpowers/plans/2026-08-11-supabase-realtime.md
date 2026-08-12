# Supabase 데이터 + Realtime 구독 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 목록과 상세 페이지를 Supabase 데이터 + Realtime 구독으로 교체하여 실시간 진행바/참여자 정보 갱신 구현

**Architecture:** 
- `group_buys` 테이블에서 공구 목록 조회 + 카테고리 필터링
- `participations` 테이블의 Realtime 구독으로 참여자 수/금액 실시간 반영
- 기존 `lib/deal.ts`의 카운트다운/마감임박 표시 로직 재사용
- Store에서 Realtime 구독 관리 + 자동 언마운트

**Tech Stack:** 
- Supabase Realtime (postgres_changes)
- React useEffect + cleanup pattern
- Zustand state management
- TypeScript + strict types

## Global Constraints

- Supabase 키/토큰은 환경 변수로 관리 (.env.local)
- participations 테이블이 user별로 RLS 제한되는 경우 필터링 로직 추가
- 카운트다운은 useNow() 훅으로 1초마다 갱신 (기존 패턴 유지)
- Realtime 구독은 컴포넌트 언마운트 시 명시적으로 정리

---

## Task 1: Supabase 스키마 확인 및 타입 정의

**Files:**
- Verify: `supabase/migrations/*.sql` (group_buys, participations 테이블 확인)
- Modify: `lib/types.ts` (Deal 타입 확장)
- Create: `lib/db-types.ts` (Supabase 행 타입)

**Interfaces:**
- Consumes: 기존 Deal 타입
- Produces: 
  - `GroupBuyRow` - group_buys 테이블 행
  - `ParticipationRow` - participations 테이블 행
  - 확장된 `Deal` 타입 (host_id: string, store_link?: string 등)

**Steps:**

- [ ] **Step 1: Supabase 테이블 스키마 확인**

`supabase/migrations/` 또는 Supabase 대시보드에서 다음 컬럼 확인:

```sql
-- group_buys 테이블
id (uuid, PK)
host_id (uuid, FK→auth.users)
title (text)
description (text)
category (enum: 식료품|배달음식|생활용품|대량구매|기타)
total_amount (numeric)
delivery_fee (numeric, default: 0)
goal (int)
joined (int) -- 현재 참여자 수
deadline (timestamp)
store_link (text, nullable)
place (text)
status (enum: recruiting|settling|completed|canceled)
created_at (timestamp)
updated_at (timestamp)

-- participations 테이블
id (uuid, PK)
group_buy_id (uuid, FK→group_buys)
user_id (uuid, FK→auth.users)
item_amount (numeric)
delivery_share (numeric)
paid (boolean)
pay_method (text, nullable)
created_at (timestamp)
updated_at (timestamp)
```

- [ ] **Step 2: 새 타입 파일 작성 (lib/db-types.ts)**

```typescript
// lib/db-types.ts

/** group_buys 테이블 행 */
export interface GroupBuyRow {
  id: string;
  host_id: string;
  title: string;
  description: string;
  category: Category;
  total_amount: number;
  delivery_fee: number;
  goal: number;
  joined: number;
  deadline: string; // ISO timestamp
  store_link: string | null;
  place: string;
  status: DealStatus;
  created_at: string;
  updated_at: string;
}

/** participations 테이블 행 */
export interface ParticipationRow {
  id: string;
  group_buy_id: string;
  user_id: string;
  item_amount: number;
  delivery_share: number;
  paid: boolean;
  pay_method: "wallet" | "account" | "toss" | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: lib/types.ts 의 Deal 타입 확장**

기존 Deal 인터페이스에 다음 필드 추가:

```typescript
export interface Deal {
  // 기존 필드들...
  id: string; // UUID로 변경 (기존 number에서 변경)
  host_id?: string; // 호스트 ID (Supabase user.id)
  status: DealStatus; // 기존 status 필드 유지
  deadline: number; // millisecond timestamp (계산된 필드)
  store_link?: string; // 배달음식 가게 링크
  description?: string; // 공고 설명
  
  // 실시간 데이터 (participations에서 계산)
  participations?: ParticipationRow[];
}
```

- [ ] **Step 4: commit**

```bash
git add lib/db-types.ts lib/types.ts
git commit -m "feat: add Supabase database types for group_buys and participations"
```

---

## Task 2: Supabase 쿼리 유틸 함수 생성

**Files:**
- Create: `lib/supabase/queries.ts`

**Interfaces:**
- Consumes: `GroupBuyRow`, `ParticipationRow` (from Task 1)
- Produces:
  - `fetchDeals(category?: string): Promise<Deal[]>`
  - `subscribeToParticipations(dealId: string, callback: (parts: ParticipationRow[]) => void): UnsubscribeFn`
  - 타입 변환 헬퍼: `rowToDeal(row: GroupBuyRow, parts: ParticipationRow[]): Deal`

**Steps:**

- [ ] **Step 1: 쿼리 유틸 파일 작성**

```typescript
// lib/supabase/queries.ts
import { createClient } from "./server"; // 또는 client (SSR 여부에 따라)
import type { Deal, Category } from "@/lib/types";
import type { GroupBuyRow, ParticipationRow } from "@/lib/db-types";

/** 공구 목록 조회 (카테고리 필터 옵션) */
export async function fetchDeals(category?: Category): Promise<Deal[]> {
  const sb = createClient();
  
  let query = sb.from("group_buys").select(`
    *,
    participations!inner (
      id,
      group_buy_id,
      user_id,
      item_amount,
      delivery_share,
      paid,
      pay_method,
      created_at,
      updated_at
    )
  `).order("created_at", { ascending: false });

  if (category && category !== "전체") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[fetchDeals]", error);
    return [];
  }

  const rows = (data ?? []) as (GroupBuyRow & { participations: ParticipationRow[] })[];
  return rows.map(row => rowToDeal(row, row.participations));
}

/** 공구 한 건 조회 */
export async function fetchDeal(dealId: string): Promise<Deal | null> {
  const sb = createClient();
  const { data, error } = await sb
    .from("group_buys")
    .select(`
      *,
      participations!inner (*)
    `)
    .eq("id", dealId)
    .single();

  if (error || !data) {
    console.error("[fetchDeal]", error);
    return null;
  }

  return rowToDeal(
    data as GroupBuyRow,
    (data as any).participations || []
  );
}

/** participations Realtime 구독 */
export function subscribeToParticipations(
  dealId: string,
  callback: (parts: ParticipationRow[]) => void
): () => void {
  const sb = createClient();

  // 초기 데이터 로드
  void (async () => {
    const { data } = await sb
      .from("participations")
      .select("*")
      .eq("group_buy_id", dealId);
    if (data) callback(data as ParticipationRow[]);
  })();

  // Realtime 구독
  const ch = sb
    .channel(`participations:${dealId}`)
    .on(
      "postgres_changes",
      { 
        event: "*", 
        schema: "public", 
        table: "participations",
        filter: `group_buy_id=eq.${dealId}`
      },
      () => {
        // 변경 시 전체 목록 다시 로드 (conflict 방지)
        void (async () => {
          const { data } = await sb
            .from("participations")
            .select("*")
            .eq("group_buy_id", dealId);
          if (data) callback(data as ParticipationRow[]);
        })();
      }
    )
    .subscribe();

  return () => {
    void sb.removeChannel(ch);
  };
}

/** 행 → 화면 모델 변환 */
function rowToDeal(row: GroupBuyRow, parts: ParticipationRow[]): Deal {
  const now = Date.now();
  const deadlineMs = new Date(row.deadline).getTime();
  const endMs = deadlineMs;

  return {
    id: row.id,
    host_id: row.host_id,
    emoji: CAT_EMOJI[row.category],
    title: row.title,
    cat: row.category,
    description: row.description,
    total: row.total_amount,
    deliveryFee: row.delivery_fee,
    goal: row.goal,
    joined: parts.length, // participations 수 = 참여자 수
    end: endMs,
    place: row.place,
    store_link: row.store_link || undefined,
    status: row.status as any,
    created_at: row.created_at,
    participations: parts,
    // 클라이언트에서 결정 (me, mine 필드는 로그인 유저 정보로 계산)
    me: false,
    mine: false,
  };
}
```

- [ ] **Step 2: CAT_EMOJI import 추가 (lib/supabase/queries.ts 상단)**

```typescript
import { CAT_EMOJI } from "@/lib/deal";
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: add Supabase query utilities for group_buys and Realtime participations"
```

---

## Task 3: Home View 개선 - Supabase 데이터 + 필터링

**Files:**
- Modify: `components/views/home.tsx`

**Interfaces:**
- Consumes: `fetchDeals()`, `setFilter()` (from store)
- Produces: 리스트 렌더링 (기존과 동일하지만 실제 Supabase 데이터)

**Steps:**

- [ ] **Step 1: fetchDeals 호출 로직 추가**

기존 코드:
```typescript
useEffect(() => {
  fetch("/api/deals")
    .then((res) => res.json())
    .then((deals) => {
      useStore.setState({ deals });
    });
}, []);
```

변경:
```typescript
useEffect(() => {
  (async () => {
    const deals = await fetchDeals();
    useStore.setState({ deals });
  })();
}, []);
```

import 추가:
```typescript
import { fetchDeals } from "@/lib/supabase/queries";
```

- [ ] **Step 2: 카테고리 필터 + 재조회**

필터 변경 시 해당 카테고리로만 조회:

```typescript
useEffect(() => {
  (async () => {
    const cat = filter === "전체" ? undefined : (filter as Category);
    const deals = await fetchDeals(cat);
    useStore.setState({ deals });
  })();
}, [filter]); // filter 의존성 추가
```

import 추가:
```typescript
import type { Category } from "@/lib/types";
```

- [ ] **Step 3: Commit**

```bash
git add components/views/home.tsx
git commit -m "feat: home view - fetch deals from Supabase with category filter"
```

---

## Task 4: Participations Realtime 구독 유틸 + Hook

**Files:**
- Create: `lib/use-realtime-participations.ts`

**Interfaces:**
- Consumes: `subscribeToParticipations()` (from Task 2)
- Produces: React Hook `useRealtimeParticipations(dealId: string): Deal`

**Steps:**

- [ ] **Step 1: useRealtimeParticipations 훅 작성**

```typescript
// lib/use-realtime-participations.ts
"use client";

import { useEffect } from "react";
import { subscribeToParticipations } from "@/lib/supabase/queries";
import { useStore } from "@/lib/store";
import type { Deal } from "@/lib/types";

/** participations Realtime 구독 + store 갱신 */
export function useRealtimeParticipations(dealId: string | null): void {
  useEffect(() => {
    if (!dealId) return;

    const unsubscribe = subscribeToParticipations(dealId, (parts) => {
      // participations 업데이트 → deals의 해당 공구 갱신
      useStore.setState((st) => ({
        deals: st.deals.map((d) =>
          d.id === dealId
            ? {
                ...d,
                joined: parts.length,
                participations: parts,
              }
            : d
        ),
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [dealId]);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/use-realtime-participations.ts
git commit -m "feat: add useRealtimeParticipations hook for real-time participation updates"
```

---

## Task 5: Detail View 개선 - Realtime 구독 + 참여자 정보 표시

**Files:**
- Modify: `components/views/detail.tsx`

**Interfaces:**
- Consumes: `useRealtimeParticipations()`, `participations` field in Deal
- Produces: 참여자 아바타, 수령지, 총액 카드 갱신

**Steps:**

- [ ] **Step 1: Realtime 구독 추가**

컴포넌트 상단에:
```typescript
import { useRealtimeParticipations } from "@/lib/use-realtime-participations";

export default function DetailView() {
  const now = useNow();
  const deals = useStore((s) => s.deals);
  const sel = useStore((s) => s.sel);
  // ... 기존 상태 읽기
  
  // Realtime 구독 시작
  useRealtimeParticipations(sel);
  
  const deal = deals.find((d) => d.id === sel) ?? deals[0];
  // ...
}
```

- [ ] **Step 2: 참여자 아바타 정보 로드**

현재 코드 (line 8, 27-28):
```typescript
const FACES = ["김", "이", "박", "최", "정"];
const faces = FACES.slice(0, Math.min(4, deal.joined));
```

변경 - participations에서 실제 사용자 정보 로드:
```typescript
// 참여자 프로필 정보 표시 (아바타 또는 닉네임 첫 글자)
const participantAvatars = (deal.participations ?? []).slice(0, 4).map(p => ({
  userId: p.user_id,
  name: p.user_id.slice(0, 1), // 임시: 나중에 profiles 조인으로 닉네임 가져오기
}));
```

렌더링 업데이트 (line 87-98):
```typescript
<div className="flex">
  {participantAvatars.map((avatar) => (
    <div
      key={avatar.userId}
      className="-mr-[7px] flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-[#dceede] text-xs font-extrabold text-[#2f6d45]"
    >
      {avatar.name}
    </div>
  ))}
  <span className="ml-3.5 self-center text-[12.5px] text-[#6b8573]">
    {deal.joined > 4 ? `+${deal.joined - 4}명 참여중` : `${deal.joined}명 참여중`}
  </span>
</div>
```

- [ ] **Step 3: 총액·배송료 카드는 기존 유지**

line 64-71은 그대로 유지 (Realtime 갱신으로 자동 반영):
```typescript
<div className="rounded-[10px] border border-[#dbe9da] bg-white px-3 py-2 text-[13px]">
  💰 총액 · <b>{fmt(deal.total)}</b>{" "}
  <span className="text-[11.5px] text-[#8aa392]">정산 전까지 변경 가능</span>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add components/views/detail.tsx
git commit -m "feat: detail view - add realtime participation updates and avatars"
```

---

## Task 6: Store 통합 - 초기 로드 + Realtime 정리

**Files:**
- Modify: `lib/store.ts`

**Interfaces:**
- Consumes: `fetchDeals()`, `useRealtimeParticipations()` (cleanup functions)
- Produces: store 초기화 + Realtime 구독 관리

**Steps:**

- [ ] **Step 1: seedDeals 대체 - Supabase 초기 로드**

기존 (line 259):
```typescript
deals: seedDeals,
```

변경:
```typescript
deals: [],
```

초기화 시 로드 추가 (store 생성 후):
```typescript
// store.ts 하단에서 exports 전에
export async function initializeDeals() {
  const deals = await fetchDeals();
  useStore.setState({ deals });
}
```

App.tsx 또는 layout 진입점에서 호출:
```typescript
useEffect(() => {
  void initializeDeals();
}, []);
```

- [ ] **Step 2: Realtime 구독 정리 함수 추가 (선택사항)**

store에 다음 추가:
```typescript
interface StoreState {
  // ... 기존 필드들
  dealUnsubscribe?: () => void;
  
  initRealtimeDeals: () => void;
  destroyRealtimeDeals: () => void;
}

// 구현
initRealtimeDeals: () => {
  // 여러 공구의 participations을 한 번에 구독할 필요가 있으면 여기서
  // 현재는 컴포넌트 레벨(detail.tsx)에서 구독하므로 선택사항
},
```

- [ ] **Step 3: Commit**

```bash
git add lib/store.ts
git commit -m "feat: store - initialize deals from Supabase on app load"
```

---

## Task 7: 테스트 및 마무리

**Files:**
- Test: 개발 서버에서 home/detail 페이지 테스트

**Steps:**

- [ ] **Step 1: 개발 서버 시작**

```bash
npm run dev
```

- [ ] **Step 2: 홈 페이지 테스트**

- [ ] Supabase 데이터 로드 확인
- [ ] 카테고리 필터 동작 확인 (필터 클릭 → 목록 갱신)
- [ ] 브라우저 콘솔에 에러 없는지 확인

- [ ] **Step 3: 상세 페이지 테스트**

- [ ] 공구 카드 클릭 → 상세 페이지 열림
- [ ] 참여자 수 실시간 갱신 (다른 창에서 참여 → 상세 페이지에서 수 증가)
- [ ] 마감 카운트다운 정상 작동 (기존 lib/deal.ts 재사용)
- [ ] 마감임박(1시간 전) 배지 표시 정상

- [ ] **Step 4: Supabase Realtime 로그 확인**

브라우저 DevTools → Network → 필터 "realtime" 또는 "postgres_changes" 확인

- [ ] **Step 5: 기존 기능 회귀 테스트**

- [ ] 참여하기 버튼 작동
- [ ] 정산 화면 진입
- [ ] 채팅방 진입
- [ ] 라운지 공유 기능

- [ ] **Step 6: Cleanup & Commit**

```bash
git add .
git commit -m "test: verify Supabase data and Realtime integration for home and detail views"
```

---

## Implementation Notes

### Deal.id 변경 (number → string)

기존 코드에서 `deal.id`가 number였으나 Supabase에서 UUID(string)로 변경됨.
- store.ts의 seedDeals 제거 후 처음부터 Supabase에서 로드
- 혹시 number id 의존 로직이 있다면 수정 필요 (git grep으로 확인)

### participations 조인 vs 별도 구독

현재 설계:
- `fetchDeals`: group_buys만 조회 (빠름)
- `subscribeToParticipations`: 공구별 구독 (상세 페이지에서)

대안:
- group_buys + participations 함께 조회 → Realtime 관리 복잡
- 현재 방식이 더 나음 (홈에서는 참여자 수만 필요, 상세에서만 정보 필요)

### Host 정보 (host_id → profiles 조인)

현재:
- `deal.host` = 문자열 닉네임

Supabase:
- `group_buys.host_id` = UUID (FK→auth.users)
- profiles에서 nickname 조인 필요

마이그레이션:
- fetchDeal에서 profiles 조인 추가 (선택사항, Task 2 확장)

### RLS (Row-Level Security)

- participations이 user별로 제한되면 필터링 필요
- 구독 시 filter 파라미터로 user_id 추가
- 현재 코드에는 미포함 (스키마 확인 후 추가)

---

## 다음 단계 (이슈 #4 이후)

- #19: 프로필 팝오버용 집계
- #10: 채팅방 공유 개선
- #13: 알림 시스템 개선
- participations 조인으로 host 닉네임 자동 로드
