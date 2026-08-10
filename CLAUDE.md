# CLAUDE.md

이 파일은 LLM 코딩 에이전트(Claude Code 등)가 이 저장소에서 작업할 때 필요한 컨텍스트를 제공합니다.

## 프로젝트 개요

**대파(대용량 파티원)** — 공고 → 참여 → 채팅 → 정산까지 한 번에 처리하는 동네 공동구매(공구) 플랫폼.
**4인 팀이 3일(2026.08.10~08.12) 동안 개발하는 해커톤 프로젝트**입니다. 속도가 최우선이며, 과한 추상화·미래 대비 설계보다 동작하는 최소 구현을 선호합니다.

- 기능 명세·데이터 모델: **[docs/PLANNING.md](./docs/PLANNING.md)**
- 역할 분배·작업 목록: **[docs/TASKS.md](./docs/TASKS.md)**

## 기술 스택

- **Next.js 15 (App Router) + TypeScript** — 프론트 + API Route 통합
- **Tailwind CSS v4** — 스타일링 (postcss 플러그인 방식, `app/globals.css`에서 `@import "tailwindcss"`)
- **Supabase** — Postgres, Auth, Realtime, Storage (연동 예정 — 현재 UI는 Zustand 목데이터)
- **Zustand** (+ 서버 상태는 TanStack Query 도입 예정)
- 영수증 자동 인식은 **보류** — 정산 총액은 수동 입력 + 동의 투표
- **Oracle Cloud VM (2 OCPU · 12GB) + Docker** 배포 (docs/DEPLOY.md), **pnpm**

## 명령어

```bash
pnpm install        # 의존성 설치
pnpm dev            # 개발 서버 (http://localhost:3000)
pnpm build          # 프로덕션 빌드 (standalone 출력)
```

환경 변수 (`.env.local`, 커밋 금지) — Supabase 연동 후 사용:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # 서버 전용 — 클라이언트 코드에서 절대 import 금지
```

## 프로젝트 구조

```
app/            Next.js App Router — page.tsx, layout.tsx, globals.css
app/api/        🔙 백엔드 Route Handlers (예정)
components/     🎨 프론트 UI — views/(화면 단위 1파일), 나머지는 공통 컴포넌트
lib/            공유 코드 — types.ts(도메인 타입), deal.ts(금액·상태 헬퍼), store.ts(Zustand)
lib/server/     🔙 백엔드 전용 서비스 로직 (예정)
supabase/       DB 스키마 SQL (예정)
docs/           기획안·작업 목록·배포·디자인 시안·발표 자료
```

경계 규칙: 서버 전용 코드(시크릿 사용)는 `app/api/**`·`lib/server/**`에만. FE/BE 공용 타입·계산은 `lib/`에 한 벌만.

## 도메인 용어

| 용어 | 의미 |
| --- | --- |
| 공구 (group_buy / deal) | 공동구매 공고 단위. 카테고리: 식료품/배달음식/생활용품/대량구매/기타 |
| 참여 (participation) | 사용자가 공구에 참여한 기록. 1인당 금액·입금 여부를 가짐 |
| 정산 (settlement) | 총액 확정(수동 입력+투표) 후 1/N 분배하는 과정 |
| 대파페이 | 인앱 모의 지갑. 충전/출금/정산 자동 결제 |
| 라운지 | 전체 공개 자유 채팅방. 공구별 채팅방과 구분됨 |

## 핵심 비즈니스 규칙 (위반 금지)

1. **공구 상태 머신**: `recruit(모집중) → settle(정산중) → completed(마감)` (+ `canceled`).
   `마감임박`은 DB 상태가 아니라 **마감 1시간 전부터 UI에서 파생 표시**한다 (`lib/deal.ts statusOf()`).
2. **총 금액 변경**은 주최자만, 모집중 상태에서만 가능. 정산 진입 시 잠금 — 클라이언트 비활성화 + **서버에서도 거부**해야 한다.
3. **금액 변경 시** 참여자 전원 알림 + 1인당 금액 재계산 + 채팅방 시스템 메시지 3종 세트가 항상 함께 발생한다.
4. **정산 계산식**: `개인 부담금 = 개인 항목 금액 + (배달비 ÷ 참여자 수)`. 배달비는 개별 조정 대상이 아니며 **항상 균등 분배**.
5. **금액은 원 단위 정수(integer)** 로 저장한다. 부동소수점 금지. 1/N 나머지는 주최자가 부담한다.
6. 참여/마감/정산/금액 변경 이벤트는 해당 공구 채팅방에 **시스템 메시지**(`Msg.kind = "sys"`)로 기록한다.
7. 시크릿(서비스 롤 키 등)은 서버 코드에서만 사용한다. 클라이언트 번들에 노출 금지.

## 디자인

- 디자인 시안은 **클로드 디자인으로 제작** — 원본: `docs/design/대파 프로토타입.dc.html` (클로드 디자인 프로젝트 "공동구매 웹앱 와이어프레임")
- 시안 전체가 이미 **React + Tailwind로 포팅 완료**되어 있다 (`components/`, `lib/store.ts` — 목데이터 기반).
  이후 작업은 **목데이터를 Supabase 연동으로 교체**하는 방향으로 진행하고, 화면 구조·스타일은 유지한다.
- 색상은 시안의 hex 값을 그대로 사용 (주 색상 `#1f8a4c`, hover `#187741`, 배경 `#eef4ec`, 사이드바 `#12311e`). 임의 팔레트 생성 금지.
- 상태 배지 문구는 `모집중` `마감임박` `정산중` `마감` 으로 고정. UI 문구는 전부 한국어.

## Git 컨벤션 (요약 — 상세는 CONTRIBUTING.md)

- 브랜치: `feat/#이슈번호-설명`, `main` 직접 push 금지
- 커밋: `feat: 제목` 형식 (feat/fix/design/refactor/chore/docs/test), 제목 한국어 OK.
  **커밋 메시지에 Co-Authored-By 트레일러를 넣지 않는다.**
- PR: 템플릿 작성, `closes #이슈번호`, approve 1개 후 **Squash merge**, 300줄 이하 권장
- 리뷰 코멘트는 **Pn 룰**: `P1:`(필수 수정) / `P2:`(권장) / `nit:`(사소) / `q:`(질문)

## 작업 시 주의사항

- 3일 프로젝트다. 테스트 커버리지·과한 에러 핸들링·미래 확장용 추상화를 만들지 마라. 요청받은 것만 구현한다.
- 실시간 기능(진행바, 채팅, 카운트다운)은 Supabase Realtime 구독을 사용한다. 폴링으로 대체하지 않는다.
- DB 스키마 변경 시 `supabase/`의 SQL과 `docs/PLANNING.md` 7번 데이터 모델 섹션을 함께 갱신한다.
- 카운트다운은 `lib/use-now.ts`의 `useNow()` 훅을 재사용한다 (화면당 1개 인터벌).
