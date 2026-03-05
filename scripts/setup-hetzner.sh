#!/bin/bash
# Run as root on a fresh Ubuntu 22.04/24.04 Hetzner server.
# Installs Python 3.12, Redis, Chromium, and systemd services for Celery.
set -e

echo "=== NWS Media Lead Engine — server setup ==="

# System packages
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git build-essential

# Python 3.12 (Ubuntu 22.04 has 3.10; 24.04 may have 3.12)
if ! command -v python3.12 &>/dev/null; then
  apt-get install -y -qq software-properties-common
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get update -qq
  apt-get install -y -qq python3.12 python3.12-venv python3.12-dev
fi

# Redis
apt-get install -y -qq redis-server
systemctl enable redis-server
systemctl start redis-server

# Chromium and deps for Playwright
apt-get install -y -qq libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2

# App directory
APP_DIR="${APP_DIR:-/opt/nwsmedia}"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# If repo already cloned, skip. Otherwise user must clone or upload.
if [ ! -f pyproject.toml ]; then
  echo ""
  echo ">>> Code not found in $APP_DIR."
  echo "    From your PC, either:"
  echo "    1. Push this project to GitHub, then on this server run:"
  echo "       git clone https://github.com/YOUR_USER/nwsmedia_engine.git $APP_DIR"
  echo "    or"
  echo "    2. From your PC (PowerShell): scp -r c:\\Users\\mkane\\nwsmedia_engine\\* root@YOUR_SERVER_IP:$APP_DIR/"
  echo ""
  echo "    Then run this script again, or continue manually."
  exit 0
fi

# Venv and Python deps
python3.12 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -e .
.venv/bin/playwright install chromium
.venv/bin/playwright install-deps chromium 2>/dev/null || true

# .env must exist with your real values
if [ ! -f .env ]; then
  echo ""
  echo ">>> Create .env with your keys. Example:"
  echo "    cp .env.example .env"
  echo "    nano .env   # paste DATABASE_URL, REDIS_URL, API keys, SUMMARY_EMAIL_*, etc."
  echo ""
  exit 0
fi

# systemd: Celery worker
cat > /etc/systemd/system/nwsmedia-worker.service << 'SVC'
[Unit]
Description=NWS Media Celery worker
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nwsmedia
Environment=PATH=/opt/nwsmedia/.venv/bin
Environment=LOG_FORMAT=json
ExecStart=/opt/nwsmedia/.venv/bin/celery -A src.celery_app worker --pool=solo --concurrency=1 -n nwsmedia@%%h
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVC

# systemd: Celery beat
cat > /etc/systemd/system/nwsmedia-beat.service << 'SVC'
[Unit]
Description=NWS Media Celery beat
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nwsmedia
Environment=PATH=/opt/nwsmedia/.venv/bin
Environment=LOG_FORMAT=json
ExecStart=/opt/nwsmedia/.venv/bin/celery -A src.celery_app beat -l INFO
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVC

# Replace /opt/nwsmedia if APP_DIR was different
sed -i "s|/opt/nwsmedia|$APP_DIR|g" /etc/systemd/system/nwsmedia-worker.service
sed -i "s|/opt/nwsmedia|$APP_DIR|g" /etc/systemd/system/nwsmedia-beat.service

systemctl daemon-reload
systemctl enable nwsmedia-worker nwsmedia-beat
systemctl start nwsmedia-worker nwsmedia-beat

echo ""
echo "=== Done. Worker and Beat are running. ==="
echo "  status: systemctl status nwsmedia-worker nwsmedia-beat"
echo "  logs:   journalctl -u nwsmedia-worker -f"
echo ""
