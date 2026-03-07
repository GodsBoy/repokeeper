# RepoKeeper

An open source, locally-running AI agent for GitHub repository maintenance.

## The Problem

Maintainers are drowning. AI-generated pull requests, duplicate issues, low-effort bug reports, and community questions pile up faster than any human can triage them. In 2026, the average popular open source repo receives more noise than signal — and maintainer burnout is at an all-time high.

## What RepoKeeper Does

RepoKeeper connects to your GitHub repository via webhooks and handles the boring parts autonomously:

- **Issue Triage** — Automatically classifies new issues (bug, feature, question, docs, invalid), detects duplicates, applies labels, and posts helpful responses
- **PR Summarisation** — Generates plain-English summaries of pull requests with per-file descriptions, flags breaking changes, and applies size labels
- **AI-Powered** — Uses Claude, GPT, or Ollama (your choice) to understand context and generate human-quality responses
- **Model-Agnostic** — Switch AI providers with a single config change — no vendor lock-in
- **Runs Locally** — Your code and data stay on your machine. No SaaS middleman.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/GodsBoy/repokeeper.git
cd repokeeper
pnpm install
```

### 2. Configure

```bash
cp repokeeper.config.example.ts repokeeper.config.ts
cp .env.example .env
```

Edit `repokeeper.config.ts` with your GitHub org/repo details.
Edit `.env` with your API keys.

### 3. Set up a GitHub webhook

In your repo's **Settings > Webhooks**, create a webhook:

- **Payload URL:** `https://your-server:3001/webhook`
- **Content type:** `application/json`
- **Secret:** Same value as `GITHUB_WEBHOOK_SECRET` in your `.env`
- **Events:** Select "Issues" and "Pull requests"

### 4. Build and run

```bash
pnpm build
pnpm start
```

### 5. Done

RepoKeeper is now listening for GitHub events. Open an issue or PR to see it in action.

## Docker Quick Start

### 1. Configure

```bash
cp repokeeper.config.example.ts repokeeper.config.ts
cp .env.example .env
```

Edit both files with your settings.

### 2. Run with Docker Compose

```bash
docker compose up -d
```

This builds the image, mounts your config file, and reads environment variables from `.env`. RepoKeeper will be available on port 3001 (or the `PORT` value in your `.env`).

To rebuild after code changes:

```bash
docker compose up -d --build
```

## Configuration Reference

All configuration lives in `repokeeper.config.ts`:

| Option | Type | Default | Description |
|---|---|---|---|
| `github.token` | `string` | `$GITHUB_TOKEN` | GitHub personal access token with `repo` scope |
| `github.webhookSecret` | `string` | `$GITHUB_WEBHOOK_SECRET` | Secret for validating webhook signatures |
| `github.owner` | `string` | — | Repository owner (org or user) |
| `github.repo` | `string` | — | Repository name |
| `ai.provider` | `"claude" \| "openai" \| "ollama"` | `"claude"` | Which AI provider to use |
| `ai.model` | `string` | `"claude-sonnet-4-6"` | Model name for the chosen provider |
| `triage.enabled` | `boolean` | `true` | Enable/disable issue triage |
| `triage.duplicateThreshold` | `number` | `0.85` | Similarity score (0-1) to flag duplicates |
| `triage.minimumBodyLength` | `number` | `100` | Minimum issue body length before adding `needs-info` |
| `prSummariser.enabled` | `boolean` | `true` | Enable/disable PR summarisation |
| `prSummariser.minDiffLines` | `number` | `50` | Minimum diff size to trigger AI summary |
| `prSummariser.generateReleaseNotes` | `boolean` | `true` | Generate release notes on merged PRs |
| `port` | `number` | `3001` | Port for the webhook server |

## Per-Repository YAML Config

You can add a `.github/repokeeper.yml` file to any repository to override specific settings. This file is fetched from the repo via the GitHub API on startup and merged with your local config (repo YAML wins for `triage`, `prSummariser`, and `ai` settings).

Example `.github/repokeeper.yml`:

```yaml
triage:
  duplicateThreshold: 0.7
  minimumBodyLength: 50

prSummariser:
  minDiffLines: 100
  generateReleaseNotes: false

ai:
  model: gpt-4o
```

Security-sensitive settings (`github.token`, `github.webhookSecret`, `port`) cannot be overridden via the YAML file.

## Supported AI Providers

| Provider | Env Variable | Notes |
|---|---|---|
| **Claude** (Anthropic) | `ANTHROPIC_API_KEY` | Default. Best quality for code understanding. |
| **GPT** (OpenAI) | `OPENAI_API_KEY` | Solid alternative. |
| **Ollama** | `OLLAMA_URL` | Free, local inference. Default URL: `http://localhost:11434` |

## Architecture

```
GitHub Webhook → Express Server → Event Router
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                    Issue Triage             PR Summariser
                          │                       │
                   ┌──────┴──────┐          ┌─────┴─────┐
                   │             │          │           │
              Classifier    Duplicate    Summariser  Labeler
                   │        Detector        │
                   └──────┬──────┘          │
                          │                 │
                     AI Provider ←──────────┘
                   (Claude/GPT/Ollama)
                          │
                     GitHub API
               (labels, comments, close)
```

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript
pnpm dev              # Run with tsx (auto-reload)
pnpm test             # Run tests
pnpm lint             # Lint with ESLint
pnpm format           # Format with Prettier
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Write tests for new functionality
4. Ensure `pnpm test` and `pnpm build` pass
5. Open a pull request

## Licence

MIT
