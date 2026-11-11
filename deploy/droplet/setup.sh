#!/usr/bin/env bash
# Ivory Park Athletics Club on a DigitalOcean droplet (Ubuntu/Debian). Safe to run again to update.
#   sudo bash deploy/droplet/setup.sh                 # uses <your-ip>.sslip.io as the address
#   sudo DOMAIN=club.example.org.za bash deploy/droplet/setup.sh   # your own domain (point its A record at the droplet first)
set -euo pipefail
cd "$(dirname "$0")"
[ "$(id -u)" = 0 ] || { echo "Run with sudo."; exit 1; }

if ! command -v docker >/dev/null; then echo "Installing Docker..."; curl -fsSL https://get.docker.com | sh; fi
docker compose version >/dev/null || { echo "Docker Compose plugin missing (apt-get install docker-compose-plugin)."; exit 1; }

# Small droplets run out of memory building the app: add 2 GB swap once if RAM is under 2 GB.
if [ "$(awk '/MemTotal/{print $2}' /proc/meminfo)" -lt 2000000 ] && ! swapon --show | grep -q /swapfile; then
  echo "Adding 2 GB swap..."; fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

touch .env; chmod 600 .env
get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2-; }
DOMAIN="${DOMAIN:-$(get DOMAIN)}"
if [ -z "$DOMAIN" ]; then IP=$(curl -fsS4 https://api.ipify.org); DOMAIN="${IP//./-}.sslip.io"; fi
TOKEN="$(get COACH_TOKEN)"; [ -n "$TOKEN" ] || TOKEN=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
printf 'DOMAIN=%s\nCOACH_TOKEN=%s\n' "$DOMAIN" "$TOKEN" > .env

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null; fi

echo "Building and starting (first time takes a few minutes)..."
docker compose up -d --build
for i in $(seq 1 30); do curl -fsS "https://$DOMAIN/health" >/dev/null 2>&1 && break; sleep 4; done

cat <<MSG

Ivory Park Athletics Club is running.
  App:        https://$DOMAIN
  Club page:  https://$DOMAIN/club
  Coach token (coaches only, keep it private): $TOKEN
On the coach's phone: open the app, Club tab, Club server settings, paste the token, Save.
Runners need nothing: the server address is built in.
Update later: git pull && sudo bash deploy/droplet/setup.sh
MSG
