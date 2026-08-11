# 🧅 대파 — 대용량 파티원

> 혼자 사기엔 너무 많고, 나눠 사면 딱 좋은.
> **공고 → 참여 → 채팅 → 정산까지 한 번에 끝내는 동네 공동구매(공구) 플랫폼**

배달비를 아끼려 이웃과 배달음식을 같이 시키고, 대용량 생필품을 나눠 사는 모든 과정을 대파에서 해결합니다.

<br>

## 📌 프로젝트 정보

| 항목 | 내용 |
| --- | --- |
| 개발 기간 | 2026.08.10 ~ 2026.08.12 (3일) |
| 팀 구성 | 4인 |
| 배포 주소 | https://daepa.nari3040.dev |

<br>

## ✨ 주요 기능

### 📢 공구 공고 올리기
- 카테고리 선택 — 식료품 / 배달음식 / 생활용품 / 대량구매 / 기타
- 배달음식 전용 폼 — 가게 링크 · 짧은 마감 시간
- 작성 중 **실시간 카드 미리보기**
- 공고 등록 시 **공구 채팅방 자동 생성**

### 🛒 공구 목록 · 상세 (실시간)
- 목표 인원 / 현재 참여자 진행바
- 남은 시간 카운트다운
- 상태 배지 — `모집중` `마감임박` `정산중` `마감`
- 1인당 금액 자동 계산
- 버튼 한 번으로 즉시 참여

### 💰 총 금액 변경
- 정산 시작 전까지 주최자가 총 금액 수정 가능
- 변경 시 참여자 전원 알림 + 1인당 금액 재계산
- 정산 시작 후에는 금액 잠금

### 💬 채팅 커뮤니티
- 동네 라운지(자유 수다) + 공구별 채팅방 자동 생성
- 공구 카드를 말풍선으로 공유 → 대화 중 바로 참여
- 참여 / 마감 / 정산 이벤트가 시스템 메시지로 표시
- 채팅방 검색

### 🧾 정산 시스템
- 영수증 인증으로 총액 자동 인식
- 균등 1/N 또는 개별 금액 조정 (배달비는 자동 균등 분배)
- 영수증이 없으면 참여자 동의 투표로 금액 확정
- 입금 현황 체크리스트 · 리마인드

### 💳 대파페이 지갑
- 잔액 조회 · 충전 · 출금
- 정산 요청 자동 결제
- 이용 내역 확인
- 계좌번호 · 토스 링크로도 송금 가능

### 👤 프로필 & ⚙️ 설정
- 팝오버 프로필 — 참여/주최 횟수, 정산 신뢰도 배지, 내 공구 내역
- 알림 설정 (마감 임박 · 입금 요청), 정산 계좌, 기본 송금 앱, 계정 관리

<br>

## 🛠 기술 스택

| 분류 | 기술 |
| --- | --- |
| 프레임워크 | Next.js 15 (App Router), TypeScript |
| 스타일링 | Tailwind CSS |
| BaaS | Supabase (Postgres · Auth · Realtime · Storage) |
| 상태 관리 | TanStack Query v5, Zustand |
| 영수증 인식 | ⏸ 보류 — 정산 총액은 수동 입력 + 동의 투표 |
| 배포 | Oracle Cloud VM (2 OCPU · 12GB) · Docker |
| 협업 도구 | GitHub, GitHub Projects |

> 선정 이유는 [docs/PLANNING.md](./docs/PLANNING.md#8-기술-스택) 참고

<br>

## 🚀 시작하기

```bash
git clone https://github.com/<org>/dae-pa.git
cd dae-pa
pnpm install

# .env.local 생성 (팀 채팅에서 키 공유 — Supabase 연동 후)
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=

pnpm dev   # http://localhost:3000
```

<br>

## 📚 문서

| 문서 | 내용 |
| --- | --- |
| [docs/PLANNING.md](./docs/PLANNING.md) | 기획안 — 기능 명세, 상태 흐름, 데이터 모델, 3일 일정 |
| [docs/TASKS.md](./docs/TASKS.md) | 4인 역할 분배 & Day별 작업 목록 (이슈 #1~#22와 1:1) |
| [docs/WORKFLOW.md](./docs/WORKFLOW.md) | 프로젝트 수행법 — 하루 루틴, 의사결정, 데모 리스크 관리 |
| [docs/GITHUB_GUIDE.md](./docs/GITHUB_GUIDE.md) | 깃허브 초심자용 단계별 가이드 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 협업 전략 — 브랜치/커밋/PR/코드 리뷰/폴더 구조 |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | 오라클 클라우드 배포 가이드 |
| [docs/design/](./docs/design/) | 클로드 디자인 시안 (프로토타입 원본) |
| [docs/presentation/](./docs/presentation/) | 발표 자료 (담당: 팀원 B) |
| [CLAUDE.md](./CLAUDE.md) | LLM 에이전트용 프로젝트 컨텍스트 |

<br>

## 👥 팀 소개

| 팀원 | 역할 | GitHub |
| --- | --- | --- |
| 팀원 A | 공구 도메인 (공고·목록·참여·금액 변경) | [@jiwookim925](https://github.com/jiwookim925) |
| 팀원 B | 채팅 + 🎤 발표 총괄 | [@jungwoo9454](https://github.com/jungwoo9454) |
| 팀원 C | 정산 · 대파페이 | [@sheunn](https://github.com/sheunn) |
| 팀원 D | 플랫폼 (Supabase·알림·배포·공통) | [@NAri3040](https://github.com/NAri3040) |

<br>

## 🤝 협업 방식

3일 스프린트에 맞춘 가벼운 GitHub Flow로 협업합니다. 자세한 규칙은 **[CONTRIBUTING.md](./CONTRIBUTING.md)** 를 참고해주세요.

- `main` 직접 push 금지 — 모든 변경은 이슈 → 브랜치 → PR로
- 브랜치: `feat/#이슈번호-설명` / 커밋: `feat: 제목` (Conventional Commits)
- PR은 1명 이상 approve 후 **Squash merge**
