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

# 프로젝트 클론
git clone https://github.com/jungwoo9454/dae-pa.git && cd dae-pa

# 환경 변수 (Supabase 연동 시)
cp .env.example .env 2>/dev/null || touch .env
```

## 3. 배포 / 업데이트

```bash
# 최초 배포
docker compose up -d --build

# 업데이트 (main 머지 후)
git pull origin main && docker compose up -d --build

# 로그 확인
docker compose logs -f web
```

→ `http://<서버 공인 IP>:3000` 접속 확인.

## 4. (선택) 도메인 + HTTPS

도메인이 있으면 Caddy 하나로 HTTPS 자동 발급:

```bash
sudo apt install -y caddy
echo "daepa.example.com {
  reverse_proxy localhost:3000
}" | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 5. 데모 전 체크리스트

- [ ] `docker compose ps` — 컨테이너 `Up` 상태
- [ ] 재부팅 후 자동 복구 확인 (`restart: unless-stopped`)
- [ ] Supabase 프로젝트 리전/키가 `.env`와 일치
- [ ] 데모 직전 `git pull` + 재빌드 금지 (Day 3 오전 이후 배포 프리즈)
