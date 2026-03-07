# RepoKeeper

[![CI](https://github.com/GodsBoy/repokeeper/actions/workflows/ci.yml/badge.svg)](https://github.com/GodsBoy/repokeeper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://hub.docker.com/)

An open source, self-hosted AI agent for GitHub repository maintenance. Deploy on a VPS and let it handle issue triage, PR summarisation, and code review across all your repos.

## Demo

https://github.com/user-attachments/assets/demo.cast

> To play locally: `asciinema play demo/demo.cast`

## The Problem

Maintainers are drowning. AI-generated pull requests, duplicate issues, low-effort bug reports, and community questions pile up faster than any human can triage them. In 2026, the average popular open source repo receives more noise than signal — and maintainer burnout is at an all-time high.

## What RepoKeeper Does

RepoKeeper connects to your GitHub repositories via webhooks and handles the boring parts autonomously:

- **Issue Triage** — Automatically classifies new issues (bug, feature, question, docs, invalid), detects duplicates, applies labels, and posts helpful responses
- **PR Summarisation** — Generates plain-English summaries of pull requests with per-file descriptions, flags breaking changes, and applies size labels
- **Code Review** — Codebase-aware AI code review with line-by-line GitHub review comments, test gap detection, configurable focus areas, and review memory
- **Multi-Repo** — Manage multiple repositories from a single instance with per-repo configuration
- **AI-Powered** — Uses Claude, GPT, or Ollama (your choice) to understand context and generate human-quality responses
- **Model-Agnostic** — Switch AI providers with a single config change — no vendor lock-in
- **Self-Hosted** — Your code and data stay on your server. No SaaS middleman. Deploy on any VPS.

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

## Production Deployment

For production use, deploy RepoKeeper on a VPS with a public IP and HTTPS. We provide two deployment methods:

- **Docker Compose** (recommended) — Nginx reverse proxy with automatic Let's Encrypt HTTPS
- **Systemd** — Direct Node.js service for non-Docker environments

See the full **[Production Deployment Guide](docs/deployment.md)** for step-by-step instructions.

### Docker Quick Start (Production)

```bash
cp .env.production.example .env   # Configure your settings
cp repokeeper.config.example.ts repokeeper.config.ts

# Get SSL certificate
DOMAIN=repokeeper.example.com EMAIL=you@example.com ./deploy/init-letsencrypt.sh

# Start the stack
docker compose -f docker-compose.prod.yml up -d
```

### Docker Quick Start (Development)

```bash
cp repokeeper.config.example.ts repokeeper.config.ts
cp .env.example .env
docker compose up -d
```

## Multi-Repo Configuration

RepoKeeper can manage multiple repositories from a single instance. Add a `repos` array to your config:

```typescript
export default {
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
  ai: {
    provider: 'claude' as const,
    model: 'claude-sonnet-4-6',
  },
  // Global defaults
  triage: { enabled: true, duplicateThreshold: 0.85 },
  prSummariser: { enabled: true },
  codeReview: { enabled: true },

  // Per-repo overrides
  repos: [
    {
      owner: 'my-org',
      repo: 'frontend',
      codeReview: { focus: ['security', 'performance', 'accessibility'] },
    },
    {
      owner: 'my-org',
      repo: 'api',
      codeReview: { focus: ['security', 'breaking-changes'] },
      ai: { model: 'gpt-4o' },
    },
    {
      owner: 'my-org',
      repo: 'docs',
      codeReview: { enabled: false },
      triage: { enabled: true },
    },
  ],
  port: 3001,
};
```

Each repo inherits the global settings and can override `triage`, `prSummariser`, `codeReview`, and `ai`. Set up one webhook per repo pointing to the same RepoKeeper instance — it routes events automatically.

Single-repo configs (with `github.owner` and `github.repo`) still work exactly as before.

## Configuration Reference

All configuration lives in `repokeeper.config.ts`:

| Option | Type | Default | Description |
|---|---|---|---|
| `github.token` | `string` | `$GITHUB_TOKEN` | GitHub personal access token with `repo` scope |
| `github.webhookSecret` | `string` | `$GITHUB_WEBHOOK_SECRET` | Secret for validating webhook signatures |
| `github.owner` | `string` | — | Repository owner (single-repo mode) |
| `github.repo` | `string` | — | Repository name (single-repo mode) |
| `repos` | `RepoEntry[]` | — | Array of repos with per-repo overrides (multi-repo mode) |
| `ai.provider` | `"claude" \| "openai" \| "ollama"` | `"claude"` | Which AI provider to use |
| `ai.model` | `string` | `"claude-sonnet-4-6"` | Model name for the chosen provider |
| `triage.enabled` | `boolean` | `true` | Enable/disable issue triage |
| `triage.duplicateThreshold` | `number` | `0.85` | Similarity score (0-1) to flag duplicates |
| `triage.minimumBodyLength` | `number` | `100` | Minimum issue body length before adding `needs-info` |
| `prSummariser.enabled` | `boolean` | `true` | Enable/disable PR summarisation |
| `prSummariser.minDiffLines` | `number` | `50` | Minimum diff size to trigger AI summary |
| `prSummariser.generateReleaseNotes` | `boolean` | `true` | Generate release notes on merged PRs |
| `codeReview.enabled` | `boolean` | `true` | Enable/disable AI code review |
| `codeReview.focus` | `string[]` | `["security", "performance", "test-coverage", "breaking-changes"]` | Review focus areas |
| `codeReview.maxContextFiles` | `number` | `5` | Max dependency files to include per changed file |
| `codeReview.minDiffLines` | `number` | `10` | Minimum added lines to trigger review |
| `port` | `number` | `3001` | Port for the webhook server |

## Per-Repository YAML Config

You can add a `.github/repokeeper.yml` file to any repository to override specific settings. This file is fetched from the repo via the GitHub API on startup and merged with your local config (repo YAML wins for `triage`, `prSummariser`, `codeReview`, and `ai` settings).

Example `.github/repokeeper.yml`:

```yaml
triage:
  duplicateThreshold: 0.7
  minimumBodyLength: 50

prSummariser:
  minDiffLines: 100
  generateReleaseNotes: false

codeReview:
  enabled: true
  focus: [security, performance, test-coverage]
  maxContextFiles: 3
  minDiffLines: 20

ai:
  model: gpt-4o
```

Security-sensitive settings (`github.token`, `github.webhookSecret`, `port`) cannot be overridden via the YAML file.

## Supported AI Providers

| Provider | Env Variable | Notes |
|---|---|---|
| **Claude** (Anthropic) | `ANTHROPIC_API_KEY` | Default. Best quality for code understanding. |
| **GPT** (OpenAI) | `OPENAI_API_KEY` | Solid alternative. Supports `OPENAI_BASE_URL` for custom endpoints. |
| **Ollama** | `OLLAMA_URL` | Free, local inference. Default URL: `http://localhost:11434` |

## Code Review

RepoKeeper provides codebase-aware AI code review that posts line-by-line review comments directly on GitHub pull requests — like a human reviewer, but faster.

### How It Works

1. **Codebase Context** — When a PR is opened or updated, RepoKeeper clones the repo and reads the import graph of each changed file. This gives the AI reviewer actual understanding of how the code fits into the project.

2. **Line-by-Line Comments** — Findings are posted as GitHub review comments on specific lines of the diff, not generic PR comments. Three severity levels:
   - **BLOCKING** — Must fix before merge (triggers `request_changes`)
   - **WARNING** — Should fix, but not a blocker
   - **SUGGESTION** — Nice to have (test gaps, style improvements)

3. **Smart Re-Review** — On `pull_request.synchronize` (new push), RepoKeeper only reviews changed hunks, skipping code it already reviewed. No duplicate noise.

4. **Test Gap Detection** — Automatically identifies new functions, methods, and classes that have no corresponding test, and suggests how to test them.

5. **Review Memory** — When a PR is merged, RepoKeeper learns from the accepted review comments. Previously-approved patterns won't be flagged again in future reviews.

6. **Configurable Focus** — Control what the review focuses on via config: `security`, `performance`, `test-coverage`, `breaking-changes`, or any custom focus area.

### Free with Ollama

The code review feature works with all three AI providers. Use Ollama for completely free, private, local code review with no API costs.

## Architecture

```
                          ┌─────────────────────┐
                          │   GitHub Webhooks    │
                          │  (one or more repos) │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   Nginx (HTTPS)     │
                          │   + Rate Limiting   │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   Express Server    │
                          │   /webhook          │
                          │   /health           │
                          │   /metrics          │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   Multi-Repo Router │
                          │  (payload routing)  │
                          └──────────┬──────────┘
                                     │
               ┌─────────────────────┼─────────────────────┐
               │                     │                     │
    ┌──────────▼─────────┐ ┌────────▼────────┐ ┌─────────▼─────────┐
    │   Issue Triage     │ │ PR Summariser   │ │   Code Review     │
    │                    │ │                 │ │                   │
    │ - Classifier       │ │ - Summariser    │ │ - Context Builder │
    │ - Duplicate Detect │ │ - Labeler       │ │ - Hunk Tracker    │
    │ - Auto-Responder   │ │ - Release Notes │ │ - Review Memory   │
    └────────┬───────────┘ └────────┬────────┘ │ - Comment Poster  │
             │                      │          └────────┬──────────┘
             └──────────────────────┼───────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    AI Provider      │
                         │ (Claude/GPT/Ollama) │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    GitHub API       │
                         │ (labels, comments,  │
                         │  reviews)           │
                         └─────────────────────┘
```

## Why RepoKeeper Over GitHub Copilot/Agentic Workflows?

| | RepoKeeper | GitHub Agentic Workflows |
|---|---|---|
| **Cost** | Free and open source | $0.002/min compute (adds up fast) |
| **Hosting** | Self-hosted on your VPS | GitHub Actions runners |
| **AI Models** | Any: Claude, GPT, Ollama, etc. | Locked to GitHub's choice |
| **Platforms** | GitHub (GitLab/Gitea planned) | GitHub only |
| **Multi-Repo** | Single instance, many repos | Per-repo setup |
| **Privacy** | Your server, your data | Code sent to GitHub's AI |
| **Maturity** | Production-ready | Technical preview |
| **Customisation** | Full config, per-repo overrides, YAML | Limited |

RepoKeeper gives you full control: run it on a $5/month VPS, use your preferred AI model, and manage all your repos from one place.

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
