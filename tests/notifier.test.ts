import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendNotification, type NotificationEvent } from '../src/notifications/notifier.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseEvent: NotificationEvent = {
  type: 'issue_triaged',
  repo: 'owner/repo',
  number: 42,
  title: 'App crashes on startup',
  url: 'https://github.com/owner/repo/issues/42',
  classification: 'bug',
  summary: 'Classified as a bug report about startup crashes.',
};

describe('sendNotification', () => {
  it('does nothing when notifications are disabled', async () => {
    await sendNotification(baseEvent, { enabled: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does nothing when enabled but no webhook URLs configured', async () => {
    await sendNotification(baseEvent, { enabled: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends to Slack when slackWebhookUrl is configured', async () => {
    await sendNotification(baseEvent, {
      enabled: true,
      slackWebhookUrl: 'https://hooks.slack.com/services/test',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/services/test');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.blocks).toBeDefined();
    expect(body.blocks[0].text.text).toContain('Issue Triaged');
    expect(body.blocks[1].text.text).toContain('App crashes on startup');
    expect(body.blocks[1].text.text).toContain(baseEvent.url);
  });

  it('sends to Discord when discordWebhookUrl is configured', async () => {
    await sendNotification(baseEvent, {
      enabled: true,
      discordWebhookUrl: 'https://discord.com/api/webhooks/test',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://discord.com/api/webhooks/test');

    const body = JSON.parse(options.body);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toContain('Issue Triaged');
    expect(body.embeds[0].title).toContain('App crashes on startup');
    expect(body.embeds[0].url).toBe(baseEvent.url);
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Classification', value: 'bug' }),
      ]),
    );
  });

  it('sends to both Slack and Discord when both are configured', async () => {
    await sendNotification(baseEvent, {
      enabled: true,
      slackWebhookUrl: 'https://hooks.slack.com/services/test',
      discordWebhookUrl: 'https://discord.com/api/webhooks/test',
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('omits classification field when not provided', async () => {
    const event: NotificationEvent = {
      type: 'pr_summarised',
      repo: 'owner/repo',
      number: 10,
      title: 'Add feature X',
      url: 'https://github.com/owner/repo/pull/10',
      summary: 'PR #10 has been summarised.',
    };

    await sendNotification(event, {
      enabled: true,
      discordWebhookUrl: 'https://discord.com/api/webhooks/test',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const fieldNames = body.embeds[0].fields.map((f: { name: string }) => f.name);
    expect(fieldNames).not.toContain('Classification');
  });

  it('does not throw when a webhook request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

    await expect(
      sendNotification(baseEvent, {
        enabled: true,
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      }),
    ).resolves.not.toThrow();
  });

  it('does not throw when fetch itself throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(
      sendNotification(baseEvent, {
        enabled: true,
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      }),
    ).resolves.not.toThrow();
  });
});
