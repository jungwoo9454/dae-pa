# Task 5 Implementation Report

## Status
DONE

## Summary
Detail 뷰에 `useRealtimeParticipations(sel)` 구독을 추가하고, 하드코딩된 FACES 아바타를 실제 `deal.participations` 기반 아바타로 교체했다.

## Modified Files
- `components/views/detail.tsx`
  - `useRealtimeParticipations` import 추가 및 컴포넌트 최상단에서 `useRealtimeParticipations(sel)` 호출 — 선택된 공구(`sel`)의 participations를 실시간 구독하고, store의 `deal.joined`/`deal.participations`를 자동 갱신
  - 하드코딩된 `FACES = ["김","이","박","최","정"]` 배열 제거
  - `participantAvatars`를 `(deal.participations ?? []).slice(0, 4)`에서 파생 — 각 항목은 `{ userId: p.user_id, initials: p.user_id.slice(0,1).toUpperCase() }` (임시 이니셜, UUID 첫 글자라 의미상 표시용일 뿐)
  - 아바타 렌더링을 `faces.map((ch, i) => ... key={i})`에서 `participantAvatars.map((avatar) => ... key={avatar.userId})`로 변경 — key를 index 대신 실제 user_id로 사용해 React 재조정 안정성 개선
  - 나머지 로직(수령 위치, 총액, 마감 카운트다운, 마감임박 배지, `deal` null 체크)은 그대로 유지

## Commits
- `73b7679` - feat: detail view - add realtime participation updates and participant avatars

## Tests
- `npx tsc --noEmit -p tsconfig.json` — 프로젝트 전체 타입체크 통과, detail.tsx 관련 에러 없음
- 코드 레벨 검토: `deal.participations`가 `undefined`인 경우(`?? []`) 및 참여자 0명인 경우 안전하게 처리됨 확인
- 별도 lint 스크립트가 프로젝트에 구성되어 있지 않아 eslint 자동 검증은 생략 (package.json에 lint 스크립트 없음, eslint.config.js 부재)
- 실제 브라우저에서의 Realtime 이벤트 수신 동작(dev server + Supabase 채널)은 수동 QA 범위 — 이번 세션에서는 실행하지 않음

## Concerns
- 아바타 이니셜은 `user_id`(UUID) 첫 글자를 사용하는 임시 구현으로, 명세에 명시된 대로 의미 있는 표시가 아니다. 추후 `profiles` 테이블 조인으로 실제 닉네임/아바타를 표시하는 별도 태스크가 필요하다.
- `git status`에 다수의 파일이 이미 modified 상태로 잡혀 있었다(프로젝트 전반의 line-ending/포맷 관련으로 추정). 이번 커밋은 `components/views/detail.tsx` 한 파일만 staged하여 범위를 좁혔다.
