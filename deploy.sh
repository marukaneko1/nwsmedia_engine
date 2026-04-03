#!/bin/bash
set -e

###############################################################################
# NWS Media CRM – Hostinger VPS deployment script
#
# Usage:
#   1. SSH into your Hostinger VPS
#   2. Clone/upload the project to /opt/nwsmedia-crm
#   3. Copy .env.production -> .env  and fill in real values
#   4. Run:  chmod +x deploy.sh && ./deploy.sh
###############################################################################

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "=========================================="
echo "  NWS Media CRM – Deploy"
echo "=========================================="
echo ""

# ── 1. Check prerequisites ─────────────────────────────────────────────────
check_prereq() {
  if ! command -v "$1" &>/dev/null; then
    echo "  ✗ $1 not found"
    return 1
  fi
  echo "  ✓ $1"
}

echo "[1/6] Checking prerequisites ..."
check_prereq docker
check_prereq "docker compose" 2>/dev/null || check_prereq docker-compose

if [ ! -f "$APP_DIR/.env" ]; then
  echo ""
  echo "  ERROR: .env file not found."
  echo "  Copy .env.production to .env and fill in real values:"
  echo "    cp .env.production .env && nano .env"
  exit 1
fi

# ── 2. Pull / build images ─────────────────────────────────────────────────
echo ""
echo "[2/6] Building Docker images ..."
cd "$APP_DIR"
$COMPOSE build --no-cache

# ── 3. Start database + redis first ────────────────────────────────────────
echo ""
echo "[3/6] Starting database & redis ..."
$COMPOSE up -d postgres redis
echo "  Waiting for PostgreSQL to be healthy ..."
until $COMPOSE exec -T postgres pg_isready -U nwscrm &>/dev/null; do
  sleep 2
done
echo "  ✓ PostgreSQL ready"

# ── 4. Run migrations ──────────────────────────────────────────────────────
echo ""
echo "[4/6] Running database migrations ..."
$COMPOSE run --rm backend sh -c "npx tsx src/migrations/run.ts"

# ── 5. Start all services ──────────────────────────────────────────────────
echo ""
echo "[5/6] Starting all services ..."
$COMPOSE up -d

# ── 6. SSL setup ───────────────────────────────────────────────────────────
echo ""
echo "[6/6] Checking SSL certificate ..."
if [ ! -d "./certbot/conf/live/crm.nwsmedia.com" ]; then
  echo "  No SSL cert found. Running initial setup ..."
  echo "  Make sure DNS A record for crm.nwsmedia.com points to this server's IP."
  echo ""
  read -p "  DNS is configured and propagated? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash init-letsencrypt.sh
  else
    echo "  Skipping SSL setup. Run ./init-letsencrypt.sh later."
  fi
else
  echo "  ✓ SSL certificate already exists"
fi

echo ""
echo "=========================================="
echo "  Deployment complete!"
echo ""
echo "  Services:"
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "  URL: https://crm.nwsmedia.com"
echo "=========================================="
