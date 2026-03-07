#!/bin/bash
# Initialize Let's Encrypt certificates for RepoKeeper
# Run this ONCE before starting the production stack

set -euo pipefail

if [ -z "${DOMAIN:-}" ]; then
  echo "Error: DOMAIN environment variable is required"
  echo "Usage: DOMAIN=repokeeper.example.com EMAIL=you@example.com ./deploy/init-letsencrypt.sh"
  exit 1
fi

EMAIL="${EMAIL:-}"
STAGING="${STAGING:-0}"

echo "Requesting certificate for: $DOMAIN"

# Start nginx temporarily for the ACME challenge
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  $([ "$STAGING" = "1" ] && echo "--staging") \
  -d "$DOMAIN"

echo "Certificate obtained. Start the stack with: docker compose -f docker-compose.prod.yml up -d"
