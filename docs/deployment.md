# Production Deployment Guide

This guide covers deploying RepoKeeper on a VPS or cloud server with a public IP address.

## Prerequisites

- A VPS with a public IP address (any provider: DigitalOcean, Hetzner, Linode, etc.)
- A domain name pointed to your server's IP (e.g., `repokeeper.example.com`)
- Docker and Docker Compose installed ([install guide](https://docs.docker.com/engine/install/))
- A GitHub personal access token with `repo` scope
- An AI provider API key (Anthropic, OpenAI, or Ollama)

## Option A: Docker Compose (Recommended)

This is the easiest way to run RepoKeeper in production. It includes Nginx as a reverse proxy with automatic HTTPS via Let's Encrypt.

### 1. Clone the repository

```bash
git clone https://github.com/GodsBoy/repokeeper.git
cd repokeeper
```

### 2. Configure environment

```bash
cp .env.production.example .env
```

Edit `.env` with your values:

```bash
# Required
GITHUB_TOKEN=ghp_your_token
GITHUB_WEBHOOK_SECRET=your_secret_here
DOMAIN=repokeeper.example.com

# AI Provider (pick one)
ANTHROPIC_API_KEY=sk-ant-your-key
# OPENAI_API_KEY=sk-your-key
# OLLAMA_URL=http://host.docker.internal:11434
```

### 3. Configure RepoKeeper

```bash
cp repokeeper.config.example.ts repokeeper.config.ts
```

Edit `repokeeper.config.ts` with your repository details. For multi-repo setups, see the [Multi-Repo Configuration](#multi-repo-configuration) section.

### 4. Obtain SSL certificate

```bash
chmod +x deploy/init-letsencrypt.sh
DOMAIN=repokeeper.example.com EMAIL=you@example.com ./deploy/init-letsencrypt.sh
```

### 5. Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

RepoKeeper is now running with HTTPS on port 443.

### 6. Set up GitHub webhook

In your repository's **Settings > Webhooks**, create a webhook:

- **Payload URL:** `https://repokeeper.example.com/webhook`
- **Content type:** `application/json`
- **Secret:** Same value as `GITHUB_WEBHOOK_SECRET` in your `.env`
- **Events:** Select "Issues" and "Pull requests"

### 7. Verify

Create a test issue in your repository. RepoKeeper should triage it within seconds. Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f repokeeper
```

### Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Health check

```bash
curl https://repokeeper.example.com/health
```

---

## Option B: Systemd (Without Docker)

For VPS deployments without Docker. Requires Node.js 22+ and pnpm.

### 1. Create a dedicated user

```bash
sudo useradd -r -m -s /bin/bash repokeeper
```

### 2. Clone and build

```bash
sudo -u repokeeper bash
cd ~
git clone https://github.com/GodsBoy/repokeeper.git
cd repokeeper
pnpm install
pnpm build
```

### 3. Configure

```bash
cp .env.production.example .env
cp repokeeper.config.example.ts repokeeper.config.ts
```

Edit both files with your settings.

### 4. Install the systemd service

```bash
sudo cp deploy/repokeeper.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable repokeeper
sudo systemctl start repokeeper
```

### 5. Check status

```bash
sudo systemctl status repokeeper
sudo journalctl -u repokeeper -f
```

### 6. Set up a reverse proxy

You'll need to set up Nginx or Caddy separately for HTTPS. Example Nginx config:

```nginx
server {
    listen 443 ssl;
    server_name repokeeper.example.com;

    ssl_certificate /etc/letsencrypt/live/repokeeper.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/repokeeper.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use `certbot` to obtain certificates: `sudo certbot --nginx -d repokeeper.example.com`

### 7. Set up GitHub webhook

Same as Docker setup — point your webhook to `https://repokeeper.example.com/webhook`.

---

## Multi-Repo Configuration

RepoKeeper can manage multiple repositories from a single instance. See the main README for configuration examples.

---

## Monitoring

### Health endpoint

```bash
curl https://repokeeper.example.com/health
```

Returns:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600,
  "eventsProcessed": 42,
  "lastEventAt": "2026-03-07T12:00:00.000Z"
}
```

### Metrics endpoint

```bash
curl https://repokeeper.example.com/metrics
```

Returns event counts by type, uptime, and per-repo stats.

---

## Troubleshooting

### Webhook not receiving events

1. Check that your domain resolves to the server IP: `dig repokeeper.example.com`
2. Check that port 443 is open: `curl -I https://repokeeper.example.com/health`
3. Check GitHub webhook delivery log in **Settings > Webhooks > Recent Deliveries**
4. Check RepoKeeper logs: `docker compose -f docker-compose.prod.yml logs repokeeper`

### Certificate renewal

Certbot auto-renews in the Docker setup. For systemd, set up a cron job:

```bash
0 0 * * * certbot renew --quiet
```

### Rate limiting

Production deployments include rate limiting (100 requests per 15 minutes per IP). If legitimate webhook deliveries are being rate-limited, adjust the `RATE_LIMIT_MAX` environment variable.
