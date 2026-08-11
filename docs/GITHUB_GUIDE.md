# 🐙 깃허브 처음이어도 되는 가이드 (대파 팀 전용)

> 깃허브를 처음 쓰는 팀원을 위해, **우리 프로젝트에서 실제로 하게 될 일만** 순서대로 정리했다.
> 규칙의 "왜"가 궁금하면 [CONTRIBUTING.md](../CONTRIBUTING.md)를 보면 된다.

## 0. 최초 1회 준비

```bash
# 1) git 설치 확인 (버전이 나오면 OK)
git --version

# 2) 내 정보 등록 (커밋에 찍히는 이름/이메일)
git config --global user.name "내이름"
git config --global user.email "깃허브가입이메일"

# 3) 프로젝트 내려받기
git clone https://github.com/jungwoo9454/dae-pa.git
cd dae-pa

# 4) 실행해보기
pnpm install   # main 푸시 차단 hook도 이때 자동 설치됩니다
pnpm dev       # http://localhost:3000 열리면 성공
```

> 🛡 `pnpm install`을 하면 `main`에 직접 push하는 것을 막아주는 안전장치가 켜집니다.
> 실수로 `main`에 push하면 차단되면서 복구 방법이 화면에 안내되니, 당황하지 말고 안내대로 따라 하면 됩니다.

> 로그인 창이 뜨거나 인증 오류가 나면 → `gh auth login` (GitHub CLI) 또는 브라우저 로그인 안내를 따르면 된다.

## 1. 우리 팀의 한 사이클 (이것만 반복)

```
이슈 잡기 → 브랜치 만들기 → 코드 작성 → 커밋 → 푸시 → PR → 리뷰 받기 → 머지
```

### ① 이슈 잡기

1. 깃허브 저장소 → **Issues** 탭 → [docs/TASKS.md](./TASKS.md)에서 내 담당으로 지정된 이슈를 찾는다
2. 이슈 오른쪽 **Assignees → assign yourself** 클릭 (내가 하는 중이라는 표시 — 중복 작업 방지)
3. 이슈 번호를 기억한다 (예: `#12`)

### ② 브랜치 만들기

**⚠️ `main`에서 직접 작업 금지!** 항상 최신 main에서 새 브랜치를 딴다.

```bash
git switch main
git pull origin main                # 최신으로 맞추기
git switch -c feat/#12-post-form    # 브랜치 생성 (feat/#이슈번호-영문설명)
```

### ③ 코드 작성 → 커밋

작업 단위가 하나 끝날 때마다 커밋한다. (하루 몰아서 1커밋 ❌)

```bash
git status                          # 뭐가 바뀌었는지 확인
git add .                           # 변경 전체 스테이징 (특정 파일만: git add 경로)
git commit -m "feat: 공고 작성 폼 카테고리 선택 구현"
```

커밋 메시지 형식: `타입: 한 일 요약` — 타입은 `feat` `fix` `design` `refactor` `chore` `docs` `test` 중 하나. 한국어 OK.

### ④ 푸시

```bash
git push origin feat/#12-post-form
# 처음 푸시면 터미널에 뜨는 --set-upstream 명령을 복사해 실행해도 된다
```

### ⑤ PR(Pull Request) 만들기

1. 푸시하면 깃허브 저장소 상단에 노란 배너 **"Compare & pull request"** 가 뜬다 → 클릭
   (안 뜨면: Pull requests 탭 → New pull request → `main ← 내 브랜치`)
2. 제목: `feat: 공고 작성 폼 구현 (#12)` — 커밋 컨벤션과 같은 형식
3. 본문 템플릿이 자동으로 뜬다 — 채우고, **`closes #12`** 를 꼭 남긴다 (머지되면 이슈 자동 닫힘)
4. 오른쪽 **Reviewers**에서 내 리뷰 파트너 지정 (A↔B, C↔D)

### ⑥ 리뷰 받기 → 반영

- 리뷰어가 코멘트를 남긴다. `P1:`이 붙은 건 **반드시 수정**, `P2:`는 권장, `nit:`는 참고.
- 수정은 같은 브랜치에서 커밋/푸시하면 PR에 자동으로 쌓인다. 다 반영하면 **Re-request review** 클릭.

### ⑦ 머지

- **Approve를 받으면 내가 직접** 초록 버튼을 눌러 머지한다. 반드시 **"Squash and merge"** 선택.
- 머지 후 **Delete branch** 클릭, 내 로컬도 정리:

```bash
git switch main && git pull origin main
git branch -d feat/#12-post-form
```

## 2. 자주 겪는 문제 응급실

| 증상 | 처방 |
| --- | --- |
| main에서 작업해버렸다 (커밋 전) | `git stash` → 브랜치 생성 → `git stash pop` |
| main에서 커밋까지 해버렸다 | `git switch -c feat/#12-작업명` (커밋이 새 브랜치로 따라옴) → `git switch main` → `git reset --hard origin/main` |
| push가 거부된다 (rejected) | 다른 사람이 먼저 푸시함 → `git pull --rebase origin 내브랜치` 후 다시 push |
| PR에 충돌(Conflict) 표시 | `git switch 내브랜치` → `git pull origin main` → 충돌 파일 열어 `<<<<` 마커 정리 → 커밋·푸시. 모르겠으면 **바로 팀에 공유** (30분 룰) |
| 커밋 메시지를 잘못 썼다 (푸시 전) | `git commit --amend -m "고친 메시지"` |
| 실수로 .env를 커밋할 뻔했다 | `.env*`는 .gitignore에 있어 원래 안 올라감. `git status`에 보인다면 즉시 팀 공유 |
| 내 브랜치에 남의 변경을 가져오고 싶다 | `git pull origin main` (작업 시작 전 아침마다 한 번 권장) |

## 3. 하지 말아야 할 것

- ❌ `main`에 직접 push (보호 규칙으로 막혀 있어도 시도하지 말기)
- ❌ `git push --force` (혼자 쓰는 브랜치에서 꼭 필요할 때만, 팀 공유 후)
- ❌ 리뷰 없이 머지 (예외: 장애성 hotfix — 팀 채팅 공유 후)
- ❌ 하나의 PR에 여러 이슈 작업 섞기
- ❌ `.env`, 키, 비밀번호 커밋

## 4. 용어 미니 사전

| 용어 | 뜻 |
| --- | --- |
| 저장소(repo) | 프로젝트 코드가 있는 깃허브 공간 |
| 브랜치 | 코드의 평행 우주. 내 작업 공간을 분리해준다 |
| 커밋 | 저장 지점. 되돌리기 가능한 체크포인트 |
| 푸시 / 풀 | 내 커밋을 깃허브에 올리기 / 깃허브 것을 받아오기 |
| PR | "내 브랜치를 main에 합쳐주세요" 요청 + 리뷰 받는 곳 |
| 머지 | PR을 main에 합치는 것. 우리는 Squash(커밋 뭉개서 1개로) 사용 |
| 이슈 | 할 일 티켓. 브랜치·PR과 번호로 연결된다 |
| 충돌(conflict) | 같은 줄을 두 명이 고쳐서 git이 못 정하는 상태. 사람이 골라줘야 한다 |
