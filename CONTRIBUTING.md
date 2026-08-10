# 🤝 대파 협업 전략

3일 · 4인 스프린트에 맞춰 **규칙은 가볍게, 속도는 빠르게**를 원칙으로 합니다.

## 1. 브랜치 전략 — GitHub Flow

3일짜리 프로젝트라 `develop` 브랜치 없이 단순하게 갑니다.

```
main ←─ PR (approve 1명, Squash merge) ←─ feat/#12-post-form
```

- **`main`** : 항상 실행 가능한 상태 유지. 직접 push 금지 (브랜치 보호 설정)
- **작업 브랜치** : 이슈 하나당 브랜치 하나. `main`에서 분기해 `main`으로 PR
- 머지된 브랜치는 바로 삭제

### 브랜치 네이밍

```
<타입>/#<이슈번호>-<짧은-설명(영문-kebab-case)>
```

| 예시 | 용도 |
| --- | --- |
| `feat/#12-post-form` | 기능 개발 |
| `fix/#34-countdown-bug` | 버그 수정 |
| `chore/#3-eslint-setup` | 세팅·잡무 |

## 2. 커밋 컨벤션 — Conventional Commits

```
<타입>: <제목(한글 OK)>

예) feat: 공구 카드 실시간 미리보기 구현
```

| 타입 | 용도 |
| --- | --- |
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `design` | UI/스타일 변경 (CSS 등) |
| `refactor` | 동작 변화 없는 코드 정리 |
| `chore` | 빌드·설정·패키지 등 잡무 |
| `docs` | 문서 |
| `test` | 테스트 |

- 제목은 50자 이내, 명령조로 ("추가함" ❌ → "추가" ⭕)
- Squash merge를 쓰므로 **PR 제목도 같은 형식**으로 작성 (`feat: 정산 1/N 분배 구현 (#21)`)

## 3. 작업 흐름 : 이슈 → 브랜치 → PR

1. **이슈 생성** — 템플릿으로 작업을 등록하고 **본인을 assign** (한 이슈 = 한 사람)
2. **브랜치 생성** — `git switch -c feat/#12-post-form`
3. **작업 & 커밋** — 커밋 컨벤션에 맞게
4. **PR 생성** — 템플릿 작성, 본문에 `closes #12` (머지 시 이슈 자동 닫힘)
5. **리뷰** — 팀원 1명 이상 approve
6. **Squash merge** — 작성자 본인이 머지하고 브랜치 삭제

## 4. 폴더 구조 (프론트 / 백엔드)

```
dae-pa/
├── app/                  # Next.js App Router
│   ├── api/              # 🔙 백엔드 — Route Handlers (예: app/api/settlements/route.ts)
│   ├── layout.tsx        # 루트 레이아웃 (폰트·메타)
│   ├── page.tsx          # 진입 페이지
│   └── globals.css       # Tailwind + 공용 스타일
├── components/           # 🎨 프론트 — UI 컴포넌트
│   ├── views/            #   화면 단위 1파일 (home, detail, chat, settle, pay, …)
│   └── *.tsx             #   공통 (sidebar, top-bar, ui, deal-card, …)
├── lib/                  # 공유 코드
│   ├── types.ts          #   도메인 타입 — FE/BE 공용, 여기 한 곳에만 정의
│   ├── deal.ts           #   도메인 헬퍼 (금액 계산·상태 파생)
│   ├── store.ts          #   클라이언트 상태 (Zustand)
│   ├── supabase/         #   Supabase 클라이언트 팩토리 (client.ts / server.ts) — 예정
│   └── server/           #   🔙 백엔드 전용 서비스 로직 — 예정
├── supabase/             # DB 스키마 SQL · 마이그레이션 — 예정
├── docs/                 # 기획안 · 배포 · 디자인 시안 · 발표 자료
└── Dockerfile 등         # 배포 (docs/DEPLOY.md 참고)
```

**경계 규칙**

- 서버 전용 코드(시크릿, service role key 사용)는 `app/api/**` 와 `lib/server/**` 에만 둔다. `"use client"` 파일에서 import 금지.
- 화면은 `components/views/` 에 1화면 1파일, 재사용 조각은 `components/` 루트에.
- FE/BE가 같이 쓰는 타입·계산 로직은 `lib/` 한 곳에만 — 복사해서 두 벌 만들지 않는다.
- DB 스키마 변경은 `supabase/` 에 SQL로 남기고 `docs/PLANNING.md` 7번도 함께 갱신한다.

## 5. 코드 리뷰 규칙

**리뷰 관점 — 이 순서로 본다** (3일 스프린트: 스타일보다 동작)

1. **동작**: 이슈의 완료 조건을 실제로 충족하는가
2. **비즈니스 규칙**: CLAUDE.md 핵심 규칙 위반 여부 (금액 잠금, 정수 저장, 배달비 균등 등)
3. **보안**: 시크릿 노출, service key가 클라이언트로 새는지, RLS 우회
4. **영향 범위**: 스키마·공통 컴포넌트·타입 변경이 다른 사람 작업을 깨는지
5. 가독성 — 심각한 경우만

**코멘트 컨벤션 (Pn 룰)** — 코멘트 앞에 접두어를 붙여 강도를 표시한다

| 접두어 | 의미 | 머지 |
| --- | --- | --- |
| `P1:` | 버그·규칙 위반·보안 — 반드시 수정 | 반영 전 머지 불가 |
| `P2:` | 수정 권장 | 작성자 판단으로 머지 가능 |
| `nit:` | 사소한 제안 (네이밍·스타일) | 무시 가능 |
| `q:` | 질문 (블로킹 아님) | — |

**리뷰어 규칙**

- 요청받으면 **1시간 안에** 확인 — 리뷰가 병목이 되면 안 됨
- P1이 없으면 **approve** (P2/nit는 approve와 함께 남기는 non-blocking 코멘트)
- 기본 리뷰 파트너: **A ↔ B**, **C ↔ D** (부재 시 아무나, docs/TASKS.md 참고)

**작성자 규칙**

- PR은 **300줄 이하** 권장 — 넘으면 쪼갠다
- 올리기 전 셀프 리뷰 (디버그 로그·주석 제거, 템플릿 체크리스트)
- P1 반영 후 re-request review, approve 받으면 **본인이 Squash merge**
- 긴급 수정(장애성 P0 hotfix)은 팀 채팅에 공유 후 셀프 머지 허용

## 6. 라벨 체계

| 분류 | 라벨 |
| --- | --- |
| 타입 | `✨ feat` `🐛 bug` `🔧 chore` `📝 docs` |
| 우선순위 | `P0` (없으면 데모 불가) · `P1` (핵심 기능) · `P2` (여유 있으면) |
| 영역 | `공고` `목록·상세` `채팅` `정산` `지갑` `프로필/설정` `공통` |

<details>
<summary>라벨 한 번에 만들기 (gh CLI)</summary>

```bash
gh label create "✨ feat" -c "a2eeef" -d "새 기능"
gh label create "🐛 bug" -c "d73a4a" -d "버그"
gh label create "🔧 chore" -c "cfd3d7" -d "세팅·잡무"
gh label create "📝 docs" -c "0075ca" -d "문서"
gh label create "P0" -c "b60205" -d "없으면 데모 불가"
gh label create "P1" -c "d93f0b" -d "핵심 기능"
gh label create "P2" -c "fbca04" -d "여유 있으면"
gh label create "공고" -c "1d76db"
gh label create "목록·상세" -c "1d76db"
gh label create "채팅" -c "1d76db"
gh label create "정산" -c "1d76db"
gh label create "지갑" -c "1d76db"
gh label create "프로필/설정" -c "1d76db"
gh label create "공통" -c "1d76db"
```

</details>

## 6. 일정 관리 — 마일스톤 & 칸반

- **마일스톤** : `Day 1 (08.10)` / `Day 2 (08.11)` / `Day 3 (08.12)` — 모든 이슈에 마일스톤 지정
- **GitHub Projects 칸반** : `Todo → In Progress → In Review → Done`
- 개발 중 새 작업이 생기면 **바로 이슈로 등록**하고 우선순위 라벨을 붙인 뒤 팀 채팅에 공유

## 7. 충돌 예방 & 커뮤니케이션

- 작업 시작 전 **반드시 이슈 assign** — 같은 파일을 두 명이 만지는 사고 방지
- 작업 시작 전 `main` 최신화 : `git pull origin main`
- **공통 파일**(라우터, DB 스키마, 공용 컴포넌트, 패키지 설정) 수정은 팀 채팅에 먼저 공지
- PR은 작게 — 기능 단위로 쪼개고, 하루 이상 묵히지 않기
- **데일리 싱크** : 매일 아침 10분 (어제 한 일 / 오늘 할 일 / 블로커)
- 블로커는 **30분 이상 혼자 붙잡지 말고** 바로 공유
