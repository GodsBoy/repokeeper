import express from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { loadConfig } from './config.js';
import { createAIProvider } from './ai/index.js';
import { GitHubClient } from './github/client.js';
import { createWebhookHandler } from './webhook/handler.js';
import { getMetrics } from './metrics.js';
import { log } from './logger.js';

async function main(): Promise<void> {
  const config = await loadConfig();
  const ai = createAIProvider(config.ai);
  const github = new GitHubClient(config.github);
  const webhookHandler = createWebhookHandler(ai, github);

  const app = express();

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });
  app.use(limiter);

  // Request logging with correlation IDs
  app.use((req, _res, next) => {
    const correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
    req.headers['x-correlation-id'] = correlationId;
    log('info', `${req.method} ${req.path}`, { correlationId });
    next();
  });

  // Parse JSON body and capture raw body for signature verification
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf-8');
      },
    }),
  );

  app.post('/webhook', webhookHandler);

  app.get('/health', (_req, res) => {
    const m = getMetrics();
    res.json({
      status: 'ok',
      version: '0.1.0',
      uptime: m.uptime,
      eventsProcessed: m.eventsProcessed,
      lastEventAt: m.lastEventAt,
    });
  });

  app.get('/metrics', (_req, res) => {
    res.json(getMetrics());
  });

  const server = app.listen(config.port, () => {
    log('info', `RepoKeeper listening on port ${config.port}`);
    log('info', `AI provider: ${config.ai.provider} (${config.ai.model})`);

    if (config.repos && config.repos.length > 0) {
      log('info', `Multi-repo mode: ${config.repos.length} repo(s) configured`);
      for (const r of config.repos) {
        log('info', `  - ${r.owner}/${r.repo}`);
      }
    } else {
      log('info', `Single-repo mode: ${config.github.owner}/${config.github.repo}`);
      log('info', `Triage: ${config.triage.enabled ? 'enabled' : 'disabled'}`);
      log('info', `PR summariser: ${config.prSummariser.enabled ? 'enabled' : 'disabled'}`);
    }
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    log('info', `Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      log('info', 'Server closed');
      process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
      log('warn', 'Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  log('error', 'Fatal error starting RepoKeeper', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
