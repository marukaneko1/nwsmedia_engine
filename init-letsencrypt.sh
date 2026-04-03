#!/bin/bash
set -e

DOMAIN="crm.nwsmedia.com"
EMAIL="admin@nwsmedia.com"               # receives renewal warnings
STAGING=0                                 # set to 1 to test against staging CA first
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Requesting Let's Encrypt certificate for $DOMAIN ..."

# 1. Create required directories
mkdir -p ./certbot/www

# 2. Download recommended TLS parameters
if [ ! -f "./certbot/conf/options-ssl-nginx.conf" ]; then
  echo "  Downloading recommended TLS parameters ..."
  mkdir -p ./certbot/conf
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > ./certbot/conf/options-ssl-nginx.conf
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
    > ./certbot/conf/ssl-dhparams.pem
fi

# 3. Create a temporary self-signed cert so nginx can start
echo "  Creating temporary self-signed certificate ..."
CERT_DIR="./certbot/conf/live/$DOMAIN"
mkdir -p "$CERT_DIR"
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN"
fi

# 4. Start nginx (it will use the self-signed cert for now)
echo "  Starting nginx ..."
$COMPOSE up -d nginx

# 5. Remove the temporary cert
echo "  Removing temporary certificate ..."
rm -rf "$CERT_DIR"

# 6. Request the real certificate
echo "  Requesting real certificate from Let's Encrypt ..."
STAGING_ARG=""
if [ "$STAGING" -eq 1 ]; then
  STAGING_ARG="--staging"
fi

$COMPOSE run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  $STAGING_ARG \
  -d "$DOMAIN"

# 7. Reload nginx with the real cert
echo "  Reloading nginx ..."
$COMPOSE exec nginx nginx -s reload

echo ""
echo "==> SSL certificate installed successfully for $DOMAIN"
echo "    Certificate will auto-renew via the certbot container."
