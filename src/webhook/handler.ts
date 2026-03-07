import type { Request, Response } from 'express';
import { verifySignature } from './verify.js';
import { getConfig } from '../config.js';
import { log } from '../logger.js';
import { handleIssueOpened } from '../triage/responder.js';
import { handlePullRequest, handlePullRequestMerged } from '../pr/summariser.js';
import type { AIProvider } from '../ai/provider.js';
import type { GitHubClient } from '../github/client.js';

export function createWebhookHandler(ai: AIProvider, github: GitHubClient) {
  return async (req: Request, res: Response): Promise<void> => {
    const config = getConfig();
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as Request & { rawBody?: string }).rawBody;

    if (!rawBody || !signature) {
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    if (!verifySignature(rawBody, signature, config.github.webhookSecret)) {
      log('warn', 'Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const event = req.headers['x-github-event'] as string;
    const action = req.body?.action as string;
    const eventKey = `${event}.${action}`;

    log('info', `Received webhook: ${eventKey}`);

    try {
      switch (eventKey) {
        case 'issues.opened':
          if (config.triage.enabled) {
            await handleIssueOpened(req.body, ai, github, config);
          }
          break;

        case 'issues.edited':
          log('info', 'Issue edited — no action for MVP');
          break;

        case 'pull_request.opened':
        case 'pull_request.synchronize':
          if (config.prSummariser.enabled) {
            await handlePullRequest(req.body, ai, github, config);
          }
          break;

        case 'pull_request.closed':
          if (config.prSummariser.enabled && req.body?.pull_request?.merged) {
            await handlePullRequestMerged(req.body, ai, github, config);
          }
          break;

        default:
          log('debug', `Unhandled event: ${eventKey}`);
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      log('error', `Error handling ${eventKey}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
