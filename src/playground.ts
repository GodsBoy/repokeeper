import type { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { AIProvider } from './ai/provider.js';
import type { RepoKeeperConfig } from './config.js';
import { log } from './logger.js';

const MAX_INPUT_LENGTH = 10_000;

const ISSUE_PROMPT = `You are a GitHub issue triage assistant. Given the following issue, classify it, suggest labels, and write a helpful response. Issue:\n\n`;

const PR_PROMPT = `You are a code review assistant. Given the following PR diff, write a concise plain-English summary of what changed and why it matters.\n\nDiff:\n\n`;

const PLAYGROUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RepoKeeper Playground</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    background: #0d1117; color: #c9d1d9;
    display: flex; justify-content: center; padding: 2rem 1rem;
  }
  .container { max-width: 720px; width: 100%; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; color: #58a6ff; }
  .subtitle { color: #8b949e; margin-bottom: 1.5rem; font-size: 0.85rem; }
  .subtitle a { color: #58a6ff; text-decoration: none; }
  .subtitle a:hover { text-decoration: underline; }
  label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9rem; }
  textarea {
    width: 100%; height: 200px; padding: 0.75rem;
    background: #161b22; color: #c9d1d9; border: 1px solid #30363d;
    border-radius: 6px; font-family: inherit; font-size: 0.85rem;
    resize: vertical;
  }
  textarea:focus { outline: none; border-color: #58a6ff; }
  .radio-group { display: flex; gap: 1.5rem; margin: 1rem 0; }
  .radio-group label { font-weight: 400; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }
  input[type="radio"] { accent-color: #58a6ff; }
  button {
    background: #238636; color: #fff; border: none;
    padding: 0.6rem 1.5rem; border-radius: 6px; cursor: pointer;
    font-family: inherit; font-size: 0.9rem; font-weight: 600;
  }
  button:hover { background: #2ea043; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .result {
    margin-top: 1.5rem; padding: 1rem;
    background: #161b22; border: 1px solid #30363d;
    border-radius: 6px; white-space: pre-wrap;
    font-size: 0.85rem; line-height: 1.5;
    display: none;
  }
  .result.visible { display: block; }
  .error { border-color: #f85149; color: #f85149; }
  .spinner { display: none; margin-left: 0.5rem; }
  .spinner.active { display: inline; }
</style>
</head>
<body>
<div class="container">
  <h1>RepoKeeper Playground</h1>
  <p class="subtitle">Try AI-powered repo maintenance instantly &mdash; <a href="https://github.com/GodsBoy/repokeeper">View on GitHub</a></p>
  <label for="input">Paste an issue or PR diff:</label>
  <textarea id="input" placeholder="Paste a GitHub issue body or PR diff here..."></textarea>
  <div class="radio-group">
    <label><input type="radio" name="type" value="issue" checked> Issue Triage</label>
    <label><input type="radio" name="type" value="pr-summary"> PR Summary</label>
  </div>
  <button id="btn" onclick="preview()">Preview<span class="spinner" id="spinner"> ...</span></button>
  <div class="result" id="result"></div>
</div>
<script>
async function preview() {
  const input = document.getElementById('input').value;
  const type = document.querySelector('input[name="type"]:checked').value;
  const btn = document.getElementById('btn');
  const spinner = document.getElementById('spinner');
  const result = document.getElementById('result');
  btn.disabled = true;
  spinner.classList.add('active');
  result.className = 'result';
  result.textContent = '';
  try {
    const res = await fetch('/playground/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, input })
    });
    const data = await res.json();
    result.classList.add('visible');
    if (data.error) {
      result.classList.add('error');
      result.textContent = data.error;
    } else {
      result.textContent = data.result;
    }
  } catch (e) {
    result.classList.add('visible', 'error');
    result.textContent = 'Network error. Please try again.';
  } finally {
    btn.disabled = false;
    spinner.classList.remove('active');
  }
}
</script>
</body>
</html>`;

interface PreviewRequest {
  type: string;
  input: string;
}

export function registerPlayground(app: Express, ai: AIProvider, config: RepoKeeperConfig): void {
  const playgroundLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Try again in a few minutes.' },
  });

  app.get('/playground', (_req: Request, res: Response) => {
    res.type('html').send(PLAYGROUND_HTML);
  });

  app.post('/playground/preview', playgroundLimiter, async (req: Request, res: Response) => {
    const { type, input } = req.body as PreviewRequest;

    if (!type || !['issue', 'pr-summary'].includes(type)) {
      res.status(400).json({ error: 'Invalid type. Must be "issue" or "pr-summary".' });
      return;
    }

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      res.status(400).json({ error: 'Please paste some content to preview.' });
      return;
    }

    if (input.length > MAX_INPUT_LENGTH) {
      res.status(400).json({ error: `Input too long. Maximum ${MAX_INPUT_LENGTH} characters.` });
      return;
    }

    const prompt = type === 'issue'
      ? ISSUE_PROMPT + input
      : PR_PROMPT + input;

    try {
      const { text } = await ai.complete(prompt);
      res.json({ result: text.trim() });
    } catch (err) {
      log('error', 'Playground AI error', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(503).json({ error: 'AI provider unavailable. Check server configuration.' });
    }
  });

  log('info', 'Playground registered at /playground');
}
