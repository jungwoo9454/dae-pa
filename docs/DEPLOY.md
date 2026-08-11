# 🚀 배포 가이드 — Oracle Cloud

## 서버 사양

| 항목 | 값 |
| --- | --- |
| 인스턴스 | Oracle Cloud VM (A1.Flex 권장) |
| 사양 | **2 OCPU · 12GB RAM** (ARM) |
| OS | Ubuntu 22.04+ |
| 실행 방식 | Docker (Next.js standalone) |

## 1. 오라클 콘솔 설정

1. VCN → 서브넷 → **Security List**에 인그레스 규칙 추가: TCP `80`, `443`, (임시로 `3000`)
2. ⚠️ 오라클 Ubuntu 이미지는 **자체 iptables가 막혀 있음** — 인스턴스 안에서도 열어야 함:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
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
흐름: 체크아웃 → rsync 로 서버 `~/dae-pa` 동기화 → `docker compose up -d --build` → 3000 포트 헬스체크.

- 서버에 저장소를 클론하지 않는다. 러너가 rsync 로 소스를 밀어 넣는다.
- `~/dae-pa/.env` 는 rsync 제외 대상 — 서버에만 있고 덮어써지지 않는다. 값 바꿀 땐 서버에서 직접 수정 후 재배포.
- 리포지토리 시크릿 `DEPLOY_KEY` = 배포 전용 ed25519 개인키 (공개키는 서버 `~/.ssh/authorized_keys`).
- 수동 실행: Actions 탭 → deploy → Run workflow.

## 4. 수동 배포 / 업데이트

```bash
# 서버에서 직접 (Actions 가 막혔을 때)
cd ~/dae-pa && docker compose up -d --build

# 로그 확인
docker compose logs -f web
```

→ `http://<서버 공인 IP>:3000` 접속 확인.

## 5. (선택) 도메인 + HTTPS

도메인이 있으면 Caddy 하나로 HTTPS 자동 발급:

```bash
sudo apt install -y caddy
echo "daepa.example.com {
  reverse_proxy localhost:3000
}" | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 6. 데모 전 체크리스트

- [ ] `docker compose ps` — 컨테이너 `Up` 상태
- [ ] 재부팅 후 자동 복구 확인 (`restart: unless-stopped`)
- [ ] Supabase 프로젝트 리전/키가 `.env`와 일치
- [ ] 데모 직전 `git pull` + 재빌드 금지 (Day 3 오전 이후 배포 프리즈)
