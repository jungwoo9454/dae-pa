# 🚀 배포 가이드 — Oracle Cloud

## 서버 사양

| 항목 | 값 |
| --- | --- |
| 인스턴스 | Oracle Cloud VM (A1.Flex 권장) |
| 사양 | **2 OCPU · 12GB RAM** (ARM) |
| OS | Ubuntu 22.04+ |
| 실행 방식 | Docker (Next.js standalone) |

## 1. 오라클 콘솔 설정

1. VCN → 서브넷 → **Security List**에 인그레스 규칙 추가: TCP `80`, `443`
2. ⚠️ 오라클 Ubuntu 이미지는 **자체 iptables가 막혀 있음** — 인스턴스 안에서도 열어야 함:

```bash
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 2. 서버 초기 세팅 (1회)

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER  # 재로그인 필요

# 배포 디렉터리 + 환경 변수 (소스는 Actions 가 rsync 로 밀어 넣는다)
mkdir -p ~/dae-pa && cd ~/dae-pa
cp ~/.env .env 2>/dev/null || touch .env   # NEXT_PUBLIC_SUPABASE_* 채우기
```

## 3. 자동 배포 (GitHub Actions)

`main`에 커밋이 들어오면 `.github/workflows/deploy.yml` 이 자동 실행된다.
흐름: 체크아웃 → rsync 로 서버 `~/dae-pa` 동기화 → `docker compose up -d --build` → 80 포트 헬스체크.

- 서버에 저장소를 클론하지 않는다. 러너가 rsync 로 소스를 밀어 넣는다.
- `~/dae-pa/.env` 는 rsync 제외 대상 — 서버에만 있고 덮어써지지 않는다. 값 바꿀 땐 서버에서 직접 수정 후 재배포.
- `NEXT_PUBLIC_*` 는 **빌드 시점에 클라이언트 번들로 박힌다.** compose 가 `.env` 를 읽어 build args 로
  넘기므로(`docker-compose.yml`), 서버 `.env` 가 비어 있으면 로그인 화면이 통째로 죽는다. 값을 바꾸면
  **재빌드**(`docker compose up -d --build`)해야 반영된다 — 컨테이너 재시작만으로는 안 바뀐다.
- 리포지토리 시크릿 `DEPLOY_KEY` = 배포 전용 ed25519 개인키 (공개키는 서버 `~/.ssh/authorized_keys`).
- 수동 실행: Actions 탭 → deploy → Run workflow.

## 4. 수동 배포 / 업데이트

```bash
# 서버에서 직접 (Actions 가 막혔을 때)
cd ~/dae-pa && docker compose up -d --build

# 로그 확인
docker compose logs -f web
```

→ `https://daepa.nari3040.dev` 접속 확인.

## 5. 도메인 + HTTPS (적용 완료)

`https://daepa.nari3040.dev` — Cloudflare DNS(A 레코드, 프록시 OFF) → 서버 Caddy → 컨테이너.

- 앱 컨테이너는 `127.0.0.1:3000` 에만 바인딩. 외부 노출은 Caddy 만 한다 (80/443)
- Caddy 가 Let's Encrypt 인증서를 자동 발급·갱신하고 80은 443으로 리다이렉트
- `/etc/caddy/Caddyfile`:

```
daepa.nari3040.dev {
  reverse_proxy 127.0.0.1:3000
}
```

- 방화벽: 22·80·443 개방 (iptables-persistent 저장). 3000은 열지 않는다
- 인증서 문제 시: `sudo journalctl -u caddy -n 50`

## 6. 데모 전 체크리스트

- [ ] `docker compose ps` — 컨테이너 `Up` 상태
- [ ] `systemctl is-active caddy` — `active`
- [ ] 재부팅 후 자동 복구 확인 (`restart: unless-stopped`)
- [ ] Supabase 프로젝트 리전/키가 `.env`와 일치
- [ ] 데모 직전 `git pull` + 재빌드 금지 (Day 3 오전 이후 배포 프리즈)
