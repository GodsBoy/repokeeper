import express from 'express';
import { loadConfig } from './config.js';
import { createAIProvider } from './ai/index.js';
import { GitHubClient } from './github/client.js';
import { createWebhookHandler } from './webhook/handler.js';
import { log } from './logger.js';
import { metrics } from './metrics.js';

async function main(): Promise<void> {
  const config = await loadConfig();
  const ai = createAIProvider(config.ai);
  const github = new GitHubClient(config.github);
  const webhookHandler = createWebhookHandler(ai, github);

  const app = express();

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
    res.json({ status: 'ok', version: '0.1.0' });
  });

  app.get('/metrics', (_req, res) => {
    res.json(metrics.getSnapshot());
  });

  app.listen(config.port, () => {
    log('info', `RepoKeeper listening on port ${config.port}`);
    log('info', `AI provider: ${config.ai.provider} (${config.ai.model})`);
    log('info', `Triage: ${config.triage.enabled ? 'enabled' : 'disabled'}`);
    log('info', `PR summariser: ${config.prSummariser.enabled ? 'enabled' : 'disabled'}`);
  });
}

main().catch((err) => {
  log('error', 'Fatal error starting RepoKeeper', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
