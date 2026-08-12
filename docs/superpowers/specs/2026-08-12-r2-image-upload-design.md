# R2 이미지 업로드 — 설계

작성 2026-08-12 · 이슈 #15 · 브랜치 `feat/#15-r2-image-upload`

## 목표

이미지 파일만 받아 서버에서 webp 로 변환해 Cloudflare R2 에 저장하고, 저장된 공개 URL 을
DB 에 넣어 다시 출력한다. 업로드 지점 4곳(영수증·아바타·공구 대표 이미지·채팅)이 같은
메커니즘 한 벌을 공유한다.

## 1. 서버

### `lib/server/r2.ts`
`@aws-sdk/client-s3` S3Client 싱글턴. `endpoint: https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`,
`region: "auto"`. 서버 전용 — 클라이언트에서 import 금지.

### `app/api/upload/route.ts` — `POST` multipart/form-data
```
auth.getUser()                                   없으면 401
kind ∈ {receipts, avatars, deals, chat}          아니면 400   ← 경로 주입 차단
file 존재 · file.size <= 10MB                    아니면 400 / 413
sharp(buf, { limitInputPixels: 5e7 }).metadata()              ← 디컴프레션 폭탄 방어
  format ∈ {jpeg,png,webp,gif,avif,heif,tiff}    아니면 400   ← 신뢰 경계
  (파싱 실패 = throw = 400)
.rotate()                                                     ← EXIF 세로사진 눕는 것 방지
.resize({ width:1600, height:1600, fit:"inside", withoutEnlargement:true })
.webp({ quality: 80 })
PutObject key=`${kind}/${crypto.randomUUID()}.webp`
          ContentType: image/webp
          CacheControl: public, max-age=31536000, immutable
→ 200 { url: `${R2_PUBLIC_URL}/${key}` }
```

magic byte 를 직접 스니핑하지 않는다 — sharp 가 이미 파서다. 포맷 화이트리스트 + 픽셀 상한 +
용량 상한이 방어선이고, 자체 스니핑을 두면 sharp 와 판정이 갈리는 두 번째 진실이 생긴다.

키에 UUID 를 쓰는 이유: `immutable` 캐시를 걸기 때문에 같은 키를 덮어쓰면 브라우저가 옛
이미지를 계속 보여준다. 아바타 교체가 반영되지 않는다.

### 환경 변수 (전부 서버 전용)
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```
클라이언트는 DB 에 저장된 완성 URL 만 읽으므로 `NEXT_PUBLIC_` 접두사가 필요 없다.

## 2. 클라이언트 공용 컴포넌트

`components/image-upload.tsx`
```tsx
<ImageUpload kind="receipts" value={url} onChange={setUrl} />
```
숨긴 `<input type="file" accept="image/*">` + 라벨 클릭 → 선택 즉시 `POST /api/upload` →
업로드 중 표시 → 성공 시 `onChange(url)` + 미리보기. 실패는 `alert` (기존 코드 관례).

## 3. 배선 4곳

| 곳 | 저장 위치 | 스키마 | UI |
| --- | --- | --- | --- |
| 영수증 #15 | `settlements.receipt_url` | 없음 | `settle.tsx` 체크박스 → ImageUpload. `store.ts` 의 `"manual"` 대신 실제 URL 을 `confirm_settlement` 에 전달. 확정 카드 스트라이프 박스 → 썸네일 |
| 아바타 | `profiles.avatar_url` | 없음 (GRANT 이미 열림) | `settings.tsx` 계정 관리에 ImageUpload → `saveProfile({ avatarUrl })` |
| 공구 대표 이미지 | `group_buys.image_url` | **컬럼 1 + GRANT 1줄** | `new-deal.tsx` → `POST /api/deals`. `detail.tsx` 220px 박스 · `deal-card.tsx` 44px 타일: 이미지 있으면 `<img>`, 없으면 현행 이모지 |
| 채팅 이미지 | `messages.payload.image_url` | **없음** (jsonb 재사용) | `chat.tsx` 입력줄 사진 버튼, 말풍선에 `<img>` |

채팅은 DB `kind='text'` 를 유지한다. 새 kind 를 만들면 `messages_own_insert` 정책의
`kind in ('text','card')` 도 같이 고쳐야 하는데, payload 재사용이면 스키마 변경이 0 이다.

`Deal.imageUrl` 은 매핑 지점이 셋이다 — 하나라도 빠지면 조용히 깨진다:
`lib/supabase/queries.ts rowToDeal()`, `lib/use-realtime-deals.ts` UPDATE 핸들러,
`app/api/deals/route.ts` 의 `dealForClient`.

`saveProfile` 은 `PROFILE_COL` 화이트리스트를 거치므로 `avatarUrl: "avatar_url"` 항목을
추가해야 한다. 없으면 `undefined` 컬럼으로 UPDATE 가 나간다.

## 4. DB 마이그레이션

`supabase/schema.sql` 은 단일 출처 파일일 뿐이고, 이미 떠 있는 Supabase 프로젝트에는
아래를 따로 실행해야 반영된다.

```sql
alter table group_buys add column if not exists image_url text;
grant update (title, description, category, store_link,
              delivery_fee, deadline, place, image_url)
  on group_buys to authenticated;
```

`grant select, insert, delete on all tables` 는 테이블 단위라 새 컬럼이 자동 포함되지만,
`group_buys` 는 `revoke update` 후 컬럼 단위로 다시 준 상태라 UPDATE 만 명시가 필요하다.

## 5. Docker / sharp

`node:22-alpine`(musl) 에서 lockfile 이 개발 머신(glibc) 기준이라 musl prebuilt 가
누락될 수 있다고 봤는데, **실제로 `docker build` 를 돌려 확인한 결과 문제 없다** —
standalone 출력 안에서 `sharp` 가 webp 를 정상 생성했다. Dockerfile 변경 불필요.
Next 15 는 `sharp` 를 기본 external 로 취급하므로 `next.config.ts` 도 그대로 둔다.
(깨졌다면 `node:22-slim`(glibc) 교체가 대응책이었다.)

Caddy `reverse_proxy` 는 기본 body 크기 제한이 없어 10MB 업로드가 그대로 통과한다.

## 6. 하지 않는 것

- 고아 파일 GC — 안 함. 3일 프로젝트다.
- 여러 장 업로드 — 지점마다 1장.
- 썸네일 variant — 원본 webp 한 장(최대 1600px)으로 목록·상세를 다 쓴다.
- presigned URL — 서버 경유. 검증을 서버에서 하려면 서버가 바이트를 봐야 한다.
- Supabase Storage `receipts` 버킷 — 안 쓴다. `schema.sql` 섹션 7 에 주석으로 표시.
- 애니메이션 GIF — sharp 가 첫 프레임만 webp 로 뽑는다.

## 7. 검증

테스트 인프라가 없는 프로젝트라 수동 3개로 대신한다.

1. jpg/png 를 올려 R2 에 `.webp` 가 생기고 화면에 출력되는지 — **4곳 전부 검증 완료**
2. `.txt` 를 `.jpg` 로 rename 해 올렸을 때 400 이 나는지 (신뢰 경계) — **검증 완료**
3. iOS 세로 사진이 눕지 않는지 (EXIF `.rotate()`) — **실물 사진 필요, 미검증**

2번은 라우트와 같은 sharp 판정 로직을 직접 돌려 확인했다:

| 입력 | 결과 |
| --- | --- |
| 텍스트를 `.jpg` 로 위장 | 400 `Input buffer contains unsupported image format` |
| 진짜 PNG 2400x900 | 통과 → 1600px 이내 webp 로 변환 |
| SVG | 400 (화이트리스트 밖 — 래스터화 시 SSRF) |

## 8. 구현 중 드러난 것 — 이 설계 밖의 결함

브라우저 검증에서 이 설계와 무관한 기존 결함 두 개가 드러났다. 하나는 이 기능이
동작하지 못하게 막아서 같이 고쳤고, 하나는 별도 이슈로 뺐다.

**고침 — `patchProfile` 이 요청을 보내지 않았다.** supabase-js 쿼리 빌더는 thenable 이라
`.then()` 이 불릴 때 비로소 fetch 한다. `void createClient()...update()` 는 `.then()` 을
부르지 않아 HTTP 요청이 아예 안 나갔다. 바로 윗줄의 낙관적 `set({ me })` 때문에 화면만
바뀌고 새로고침하면 되돌아간다. 호출부 4곳(닉네임·계좌·송금 앱·아바타, 자동 결제 토글,
마감 알림, 입금 알림)이 전부 무동작이었다. 아바타 저장이 이 경로를 타므로 함께 고쳤다.

**이슈로 분리 — 정산 실시간이 안 붙는다.** `settlements`·`settlement_votes` 가 realtime
publication 에 없어서(`group_buys, messages, notifications, participations, wallets,
wallet_transactions` 만 등록) `subscribeToSettlement` 채널에 이벤트가 오지 않는다.
영수증뿐 아니라 투표·금액 확정 전부 새로고침해야 반영된다. 덤으로 `queries.ts` 가 채널을
`unsubscribe()` 만 하고 `removeChannel()` 을 안 해서 같은 이름 채널이 재사용되며
`cannot add postgres_changes callbacks ... after subscribe()` 가 난다. 둘 다 정산 실시간
배관 문제라 이 PR 범위 밖이고, 이슈 #77·#78 로 분리했다.

## 9. 알아둘 것

`r2.dev` 공개 버킷은 키를 아는 사람이면 누구나 조회할 수 있다. 키가 UUID 라 사실상 추측이
불가능하지만, **영수증 사진에 개인정보가 찍혀 있다면 그건 공개 URL 뒤에 놓인다.** 3일 데모
범위에서는 감수하고, 운영으로 가려면 버킷을 비공개로 돌리고 `/api/images/<key>` 프록시로
바꾼다.
