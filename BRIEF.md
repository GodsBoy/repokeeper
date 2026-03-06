# RepoKeeper — Phase 1 Build Brief

## What Is RepoKeeper

RepoKeeper is an open source, locally-running AI agent for GitHub repository maintenance.
It solves a real and growing pain: OSS maintainers are drowning in AI-generated PR noise,
duplicate issues, and community questions. RepoKeeper handles the boring parts autonomously
so maintainers can focus on what matters.

**Target users:** Any developer maintaining a GitHub repository.
**Differentiator:** Locally-running, model-agnostic (Claude/GPT/Ollama), works via GitHub webhooks,
no vendor lock-in, fully open source MIT licence.

---

## Phase 1 Scope (build this now)

### 1. Project Setup
- TypeScript + Node.js (ESM, strict mode)
- Package manager: pnpm
- Target: Node 22+
- Entry point: `src/index.ts`
- Config: `repokeeper.config.ts` (type-safe) at repo root

### 2. GitHub Webhook Listener
- Express server listening for GitHub webhook events
- Validate webhook signatures (HMAC-SHA256, `X-Hub-Signature-256` header)
- Handle events: `issues.opened`, `issues.edited`, `pull_request.opened`, `pull_request.synchronize`
- Reject invalid signatures with 401
- Structured logging with timestamps

### 3. Issue Triage (on `issues.opened`)
Given a new issue, the agent must:
- **Classify** the issue: bug | feature | question | duplicate | docs | invalid
- **Detect duplicates**: search open issues via GitHub API, compare title + body semantically (use AI embedding or keyword heuristic — keep it simple for MVP)
- **Label** the issue via GitHub API (`gh labels` — create labels if not exists)
- **Respond** with a helpful comment:
  - If duplicate: link to the existing issue, thank the reporter, close the issue
  - If bug: acknowledge, ask for reproduction steps if missing, add `needs-info` label if body < 100 chars
  - If feature: acknowledge, add `enhancement` label
  - If question: acknowledge, point to docs/README if exists
- **Never** respond rudely. Friendly, professional tone always.

### 4. PR Summariser (on `pull_request.opened` and `pull_request.synchronize`)
- Fetch the PR diff via GitHub API
- If diff > 500 lines: summarise with AI (Claude by default)
- Post a comment on the PR with:
  - 2-3 sentence plain English summary of what changed and why
  - List of files changed with brief per-file description
  - Flags: breaking changes detected? Tests added? Docs updated?
- Label the PR: `size/small` (<100 lines), `size/medium` (100-500), `size/large` (500+)

### 5. AI Provider Abstraction
- Interface: `AIProvider` with `complete(prompt: string): Promise<string>`
- Implementations:
  - `ClaudeProvider` — uses Anthropic SDK, reads `ANTHROPIC_API_KEY` from env
  - `OpenAIProvider` — uses OpenAI SDK, reads `OPENAI_API_KEY` from env
  - `OllamaProvider` — uses Ollama HTTP API, reads `OLLAMA_URL` from env (default: http://localhost:11434)
- Config selects which provider to use: `provider: "claude" | "openai" | "ollama"`
- Default: claude

### 6. Configuration Schema (`repokeeper.config.ts`)
```typescript
export default {
  github: {
    token: process.env.GITHUB_TOKEN,     // required: PAT with repo scope
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,  // required
    owner: "your-org",                   // required: repo owner
    repo: "your-repo",                   // required: repo name
  },
  ai: {
    provider: "claude",                  // "claude" | "openai" | "ollama"
    model: "claude-sonnet-4-6",         // model name for the chosen provider
  },
  triage: {
    enabled: true,
    duplicateThreshold: 0.85,           // similarity score 0-1
    minimumBodyLength: 100,             // chars — below this, add needs-info
  },
  prSummariser: {
    enabled: true,
    minDiffLines: 50,                   // only summarise PRs above this size
  },
  port: 3001,
}
```

### 7. README.md
Write a compelling, professional README covering:
- **Problem statement** (maintainer burnout, AI slop PRs flooding repos in 2026)
- **What RepoKeeper does** (clear bullet list)
- **Quick start** (5 steps: install, configure, set up webhook, run, done)
- **Configuration reference** (all config options with descriptions)
- **Supported AI providers** (Claude, GPT, Ollama)
- **Architecture overview** (brief — webhook → triage engine → AI → GitHub API)
- **Contributing** section
- **Licence**: MIT

### 8. Basic Tests
- Unit tests for: webhook signature validation, issue classifier, label creation logic
- Use Vitest
- At least 10 tests total
- Run with: `pnpm test`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22+ |
| Language | TypeScript (strict) |
| Package manager | pnpm |
| Web server | Express |
| GitHub API | @octokit/rest |
| Anthropic SDK | @anthropic-ai/sdk |
| OpenAI SDK | openai |
| Testing | Vitest |
| Linting | ESLint + Prettier |

---

## Git Conventions

- Author: `GodsBoy <dhuysamen@gmail.com>` (already configured in this repo)
- Commit message format: `feat: <description>` / `fix:` / `docs:` / `test:`
- Make small, logical commits as you go — do not do one giant commit at the end
- Push to `main` branch on GodsBoy/repokeeper (private repo)

---

## Directory Structure to Aim For

```
repokeeper/
├── src/
│   ├── index.ts              # entry point, starts webhook server
│   ├── config.ts             # loads and validates config
│   ├── webhook/
│   │   ├── handler.ts        # routes events to handlers
│   │   └── verify.ts         # HMAC signature verification
│   ├── triage/
│   │   ├── classifier.ts     # classifies issue type
│   │   ├── duplicate.ts      # duplicate detection
│   │   └── responder.ts      # posts GitHub comments
│   ├── pr/
│   │   ├── summariser.ts     # generates PR summaries
│   │   └── labeler.ts        # applies size labels
│   ├── ai/
│   │   ├── provider.ts       # AIProvider interface
│   │   ├── claude.ts         # Claude implementation
│   │   ├── openai.ts         # OpenAI implementation
│   │   └── ollama.ts         # Ollama implementation
│   └── github/
│       └── client.ts         # Octokit wrapper
├── tests/
│   └── *.test.ts
├── repokeeper.config.ts      # user config (gitignored example provided)
├── repokeeper.config.example.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── .env.example
└── README.md
```

---

## Definition of Done for Phase 1

- [ ] `pnpm install` works cleanly
- [ ] `pnpm build` compiles without TypeScript errors
- [ ] `pnpm test` passes all tests
- [ ] `pnpm start` starts the webhook server
- [ ] Webhook receives a test `issues.opened` payload → issue gets labelled and commented
- [ ] Webhook receives a test `pull_request.opened` payload → PR gets summarised and labelled
- [ ] README is clear enough for a stranger to set this up in 10 minutes
- [ ] All code committed and pushed to GodsBoy/repokeeper

---

## Important Notes

- Do NOT over-engineer. Phase 1 is an MVP. Keep it clean and functional.
- If a feature would take more than it's worth for Phase 1, stub it and add a TODO comment.
- The duplicate detection for MVP can be simple keyword overlap — no need for embeddings yet.
- All secrets via environment variables, never hardcoded.
- The config file is gitignored; provide `.example` files.
- After each major section is done, commit and push.
