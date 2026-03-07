import type { Request, Response } from 'express';
import { verifySignature } from './verify.js';
import { getConfig, resolveRepoConfig } from '../config.js';
import { log } from '../logger.js';
import { handleIssueOpened } from '../triage/responder.js';
import { handlePullRequest, handlePullRequestMerged } from '../pr/summariser.js';
import { handleCodeReview, handleCodeReviewMerged } from '../review/reviewer.js';
import type { AIProvider } from '../ai/provider.js';
import { GitHubClient } from '../github/client.js';

export function createWebhookHandler(ai: AIProvider, _defaultGithub: GitHubClient) {
  return async (req: Request, res: Response): Promise<void> => {
    const globalConfig = getConfig();
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as Request & { rawBody?: string }).rawBody;

    if (!rawBody || !signature) {
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    if (!verifySignature(rawBody, signature, globalConfig.github.webhookSecret)) {
      log('warn', 'Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const event = req.headers['x-github-event'] as string;
    const action = req.body?.action as string;
    const eventKey = `${event}.${action}`;

    // Route to the correct repo config based on the webhook payload
    const repoOwner = req.body?.repository?.owner?.login as string | undefined;
    const repoName = req.body?.repository?.name as string | undefined;

    if (!repoOwner || !repoName) {
      log('warn', `Webhook ${eventKey} missing repository info`);
      res.status(400).json({ error: 'Missing repository info in payload' });
      return;
    }

    const config = resolveRepoConfig(repoOwner, repoName);

    // Check if this repo is configured (for multi-repo mode)
    if (globalConfig.repos && globalConfig.repos.length > 0) {
      const match = globalConfig.repos.find(
        (r) => r.owner.toLowerCase() === repoOwner.toLowerCase() && r.repo.toLowerCase() === repoName.toLowerCase(),
      );
      if (!match) {
        log('debug', `Ignoring webhook for unconfigured repo ${repoOwner}/${repoName}`);
        res.status(200).json({ ok: true, skipped: true });
        return;
      }
    }

    // Create a GitHubClient scoped to this repo
    const github = new GitHubClient(config.github);

    log('info', `Received webhook: ${eventKey} for ${repoOwner}/${repoName}`);

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
          if (config.codeReview.enabled) {
            await handleCodeReview(req.body, ai, github, config);
          }
          break;

        case 'pull_request.closed':
          if (config.prSummariser.enabled && req.body?.pull_request?.merged) {
            await handlePullRequestMerged(req.body, ai, github, config);
          }
          if (config.codeReview.enabled && req.body?.pull_request?.merged) {
            await handleCodeReviewMerged(req.body, config);
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
