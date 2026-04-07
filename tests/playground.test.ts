import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerPlayground } from '../src/playground.js';
import type { AIProvider } from '../src/ai/provider.js';
import type { RepoKeeperConfig } from '../src/config.js';

function createApp(ai: AIProvider) {
  const app = express();
  app.use(express.json());

  const config: RepoKeeperConfig = {
    github: { token: 'test', webhookSecret: 'test', owner: 'test', repo: 'test' },
    ai: { provider: 'claude', model: 'test' },
    triage: { enabled: true, duplicateThreshold: 0.7, minimumBodyLength: 100 },
    prSummariser: { enabled: true, minDiffLines: 50, generateReleaseNotes: false },
    codeReview: { enabled: true, focus: [], maxContextFiles: 5, minDiffLines: 10 },
    attribution: { enabled: true },
    notifications: { enabled: false },
    port: 3001,
  };

  registerPlayground(app, ai, config);
  return app;
}

function mockAI(response: string): AIProvider {
  return {
    complete: vi.fn().mockResolvedValue({ text: response, usage: { inputTokens: 10, outputTokens: 20 } }),
  };
}

function failingAI(): AIProvider {
  return {
    complete: vi.fn().mockRejectedValue(new Error('API key invalid')),
  };
}

describe('GET /playground', () => {
  it('returns HTML page', async () => {
    const app = createApp(mockAI('response'));
    const res = await request(app).get('/playground');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('html');
    expect(res.text).toContain('RepoKeeper Playground');
    expect(res.text).toContain('textarea');
  });
});

describe('POST /playground/preview', () => {
  it('returns AI result for issue type', async () => {
    const ai = mockAI('This is a bug report about login failures.');
    const app = createApp(ai);
    const res = await request(app)
      .post('/playground/preview')
      .send({ type: 'issue', input: 'Login is broken' });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('This is a bug report about login failures.');
    expect(ai.complete).toHaveBeenCalledWith(expect.stringContaining('triage assistant'));
  });

  it('returns AI result for pr-summary type', async () => {
    const ai = mockAI('Added a new feature to handle auth.');
    const app = createApp(ai);
    const res = await request(app)
      .post('/playground/preview')
      .send({ type: 'pr-summary', input: 'diff --git a/auth.ts' });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('Added a new feature to handle auth.');
    expect(ai.complete).toHaveBeenCalledWith(expect.stringContaining('code review assistant'));
  });

  it('returns 400 for empty input', async () => {
    const app = createApp(mockAI('x'));
    const res = await request(app)
      .post('/playground/preview')
      .send({ type: 'issue', input: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('paste some content');
  });

  it('returns 400 for whitespace-only input', async () => {
    const app = createApp(mockAI('x'));
    const res = await request(app)
      .post('/playground/preview')
      .send({ type: 'issue', input: '   \n  ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('paste some content');
  });

  it('returns 400 for input exceeding 10000 characters', async () => {
    const app = createApp(mockAI('x'));
    const res = await request(app)
      .post('/playground/preview')
      .send({ type: 'issue', input: 'a'.repeat(10_001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('too long');
  });

  it('returns 400 for invalid type', async () => {
    const app = createApp(mockAI('x'));
    const res = await request(app)
      .post('/playground/preview')
      .send({ type: 'unknown', input: 'some content' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid type');
  });

  it('returns 503 when AI provider fails', async () => {
    const app = createApp(failingAI());
    const res = await request(app)
      .post('/playground/preview')
      .send({ type: 'issue', input: 'some content' });
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('AI provider unavailable');
    expect(res.body.error).not.toContain('API key');
  });
});
