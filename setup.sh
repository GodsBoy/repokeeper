#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║          RepoKeeper Setup Wizard             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# --- GitHub Token ---
read -rp "GitHub personal access token (repo scope): " GITHUB_TOKEN
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Error: GitHub token is required."
  exit 1
fi

# --- Webhook Secret ---
read -rp "GitHub webhook secret (leave blank to auto-generate): " WEBHOOK_SECRET
if [[ -z "$WEBHOOK_SECRET" ]]; then
  WEBHOOK_SECRET=$(openssl rand -hex 20)
  echo "Generated webhook secret: $WEBHOOK_SECRET"
fi

# --- Repo details ---
read -rp "GitHub repo owner (org or user): " REPO_OWNER
read -rp "GitHub repo name: " REPO_NAME

if [[ -z "$REPO_OWNER" || -z "$REPO_NAME" ]]; then
  echo "Error: Repo owner and name are required."
  exit 1
fi

# --- AI Provider ---
echo ""
echo "Choose your AI provider:"
echo "  1) claude  (Anthropic — requires ANTHROPIC_API_KEY)"
echo "  2) openai  (OpenAI — requires OPENAI_API_KEY)"
echo "  3) ollama  (Local — free, no API key needed)"
read -rp "Select [1/2/3]: " AI_CHOICE

case "$AI_CHOICE" in
  1)
    AI_PROVIDER="claude"
    AI_MODEL="claude-haiku-4-5"
    read -rp "Anthropic API key: " API_KEY
    ENV_KEY_LINE="ANTHROPIC_API_KEY=$API_KEY"
    ;;
  2)
    AI_PROVIDER="openai"
    AI_MODEL="gpt-4o-mini"
    read -rp "OpenAI API key: " API_KEY
    ENV_KEY_LINE="OPENAI_API_KEY=$API_KEY"
    ;;
  3)
    AI_PROVIDER="ollama"
    AI_MODEL="llama3.1"
    read -rp "Ollama URL [http://localhost:11434]: " OLLAMA_URL
    OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
    ENV_KEY_LINE="OLLAMA_URL=$OLLAMA_URL"
    ;;
  *)
    echo "Invalid choice. Defaulting to claude."
    AI_PROVIDER="claude"
    AI_MODEL="claude-haiku-4-5"
    read -rp "Anthropic API key: " API_KEY
    ENV_KEY_LINE="ANTHROPIC_API_KEY=$API_KEY"
    ;;
esac

# --- Port ---
read -rp "Server port [3001]: " PORT
PORT="${PORT:-3001}"

# --- Generate .env ---
cat > .env <<ENVEOF
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_WEBHOOK_SECRET=$WEBHOOK_SECRET
$ENV_KEY_LINE
ENVEOF

echo ""
echo "Created .env"

# --- Generate repokeeper.config.ts ---
cat > repokeeper.config.ts <<CONFEOF
export default {
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    owner: '$REPO_OWNER',
    repo: '$REPO_NAME',
  },
  ai: {
    provider: '$AI_PROVIDER' as const,
    model: '$AI_MODEL',
  },
  triage: {
    enabled: true,
    duplicateThreshold: 0.7,
    minimumBodyLength: 100,
  },
  prSummariser: {
    enabled: true,
    minDiffLines: 10,
    generateReleaseNotes: true,
  },
  codeReview: {
    enabled: true,
  },
  port: $PORT,
};
CONFEOF

echo "Created repokeeper.config.ts"

# --- Build ---
echo ""
echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo ""
echo "Building..."
pnpm build

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║              Setup Complete!                 ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Set up a GitHub webhook:"
echo "     - Go to https://github.com/$REPO_OWNER/$REPO_NAME/settings/hooks"
echo "     - Payload URL: https://your-server:$PORT/webhook"
echo "     - Content type: application/json"
echo "     - Secret: $WEBHOOK_SECRET"
echo "     - Events: Issues + Pull requests"
echo ""
echo "  2. Start RepoKeeper:"
echo "     pnpm start"
echo ""
echo "  3. Use a tunnel for local development:"
echo "     npx cloudflared tunnel --url http://localhost:$PORT"
echo ""
