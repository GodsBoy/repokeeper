import type { RepoKeeperConfig } from '../config.js';
import { log } from '../logger.js';

export interface NotificationEvent {
  type: 'issue_triaged' | 'pr_reviewed' | 'pr_summarised';
  repo: string;
  number: number;
  title: string;
  url: string;
  classification?: string;
  summary: string;
}

export async function sendNotification(
  event: NotificationEvent,
  config: RepoKeeperConfig['notifications'],
): Promise<void> {
  if (!config.enabled) return;

  const promises: Promise<void>[] = [];

  if (config.slackWebhookUrl) {
    promises.push(sendSlack(event, config.slackWebhookUrl));
  }
  if (config.discordWebhookUrl) {
    promises.push(sendDiscord(event, config.discordWebhookUrl));
  }

  await Promise.allSettled(promises);
}

function eventLabel(type: NotificationEvent['type']): string {
  switch (type) {
    case 'issue_triaged': return 'Issue Triaged';
    case 'pr_reviewed': return 'PR Reviewed';
    case 'pr_summarised': return 'PR Summarised';
  }
}

function eventEmoji(type: NotificationEvent['type']): string {
  switch (type) {
    case 'issue_triaged': return '🏷️';
    case 'pr_reviewed': return '🔍';
    case 'pr_summarised': return '📝';
  }
}

async function sendSlack(event: NotificationEvent, webhookUrl: string): Promise<void> {
  const fields = [
    { type: 'mrkdwn', text: `*Repo:*\n${event.repo}` },
    { type: 'mrkdwn', text: `*Number:*\n#${event.number}` },
  ];

  if (event.classification) {
    fields.push({ type: 'mrkdwn', text: `*Classification:*\n${event.classification}` });
  }

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${eventEmoji(event.type)} ${eventLabel(event.type)}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*<${event.url}|${event.title}>*\n${event.summary}` },
      },
      {
        type: 'section',
        fields,
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      log('warn', `Slack notification failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    log('warn', 'Slack notification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function sendDiscord(event: NotificationEvent, webhookUrl: string): Promise<void> {
  const fields = [
    { name: 'Repo', value: event.repo, inline: true },
    { name: 'Number', value: `#${event.number}`, inline: true },
  ];

  if (event.classification) {
    fields.push({ name: 'Classification', value: event.classification, inline: true });
  }

  const payload = {
    embeds: [
      {
        title: `${eventEmoji(event.type)} ${eventLabel(event.type)}: ${event.title}`,
        url: event.url,
        description: event.summary,
        fields,
        color: event.type === 'issue_triaged' ? 0x2ea44f : 0x0969da,
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      log('warn', `Discord notification failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    log('warn', 'Discord notification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
