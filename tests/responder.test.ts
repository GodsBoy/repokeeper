import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleIssueOpened } from '../src/triage/responder.js';
import type { AIProvider } from '../src/ai/provider.js';
import type { GitHubClient } from '../src/github/client.js';
import type { RepoKeeperConfig } from '../src/config.js';

function createMockAI(classifyResponse: string, commentResponse: string): AIProvider {
  let callCount = 0;
  return {
    complete: async (prompt: string) => {
      // Duplicate detection calls come first, then classify, then comment
      if (prompt.includes('duplicate issue detector')) return '0.1';
      callCount++;
      // Even calls = classify, odd calls = comment (roughly)
      if (prompt.includes('classifier') || prompt.includes('Classify')) return classifyResponse;
      return commentResponse;
    },
  };
}

function createMockGithub() {
  return {
    listOpenIssues: vi.fn().mockResolvedValue([]),
    addLabels: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    closeIssue: vi.fn().mockResolvedValue(undefined),
  } as unknown as GitHubClient;
}

function createConfig(overrides?: Partial<RepoKeeperConfig['triage']>): RepoKeeperConfig {
  return {
    github: { token: 'test', webhookSecret: 'test', owner: 'test', repo: 'test' },
    ai: { provider: 'claude', model: 'test' },
    triage: {
      enabled: true,
      duplicateThreshold: 0.7,
      minimumBodyLength: 100,
      ...overrides,
    },
    prSummariser: { enabled: false, minDiffLines: 50, generateReleaseNotes: false },
    codeReview: { enabled: false, focus: [], maxContextFiles: 5, minDiffLines: 10 },
    port: 3001,
  };
}

describe('handleIssueOpened', () => {
  it('labels vague issues as needs-more-info', async () => {
    const ai = createMockAI('bug', 'Please provide more details about your issue.');
    const github = createMockGithub();
    const config = createConfig();

    await handleIssueOpened(
      { issue: { number: 1, title: 'app wont start', body: 'its broken' } },
      ai,
      github,
      config,
    );

    expect(github.addLabels).toHaveBeenCalledWith(1, ['needs-more-info']);
  });

  it('labels detailed bug reports as bug', async () => {
    const ai = createMockAI('bug', 'Thanks for reporting this crash on login.');
    const github = createMockGithub();
    const config = createConfig();

    const detailedBody = 'The application crashes when I try to login. I am using Chrome on Windows 10. ' +
      'The console shows a TypeError: Cannot read property of undefined. Stack trace is below.';

    await handleIssueOpened(
      { issue: { number: 2, title: 'Login crash', body: detailedBody } },
      ai,
      github,
      config,
    );

    expect(github.addLabels).toHaveBeenCalledWith(2, ['bug']);
  });

  it('posts AI-generated comment, not static template', async () => {
    const contextualComment = 'This crash on the login page looks like it could be related to the auth module. We will investigate.';
    const ai = createMockAI('bug', contextualComment);
    const github = createMockGithub();
    const config = createConfig();

    const detailedBody = 'The application crashes when I try to login. I am using Chrome on Windows 10. ' +
      'The console shows a TypeError: Cannot read property of undefined. Stack trace is below.';

    await handleIssueOpened(
      { issue: { number: 3, title: 'Login crash', body: detailedBody } },
      ai,
      github,
      config,
    );

    const commentCall = (github.addComment as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(commentCall[1]).not.toContain('Thanks for the detailed bug report');
  });

  it('never says "Thanks for the detailed bug report" on vague issues', async () => {
    const ai = createMockAI('bug', 'We need more info to investigate this issue about startup problems.');
    const github = createMockGithub();
    const config = createConfig();

    await handleIssueOpened(
      { issue: { number: 4, title: 'doesnt work', body: 'broken.' } },
      ai,
      github,
      config,
    );

    const commentCall = (github.addComment as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(commentCall[1]).not.toContain('Thanks for the detailed bug report');
  });

  it('flags duplicates with possible-duplicate label instead of closing', async () => {
    const ai: AIProvider = {
      complete: async (prompt: string) => {
        if (prompt.includes('duplicate issue detector')) return '0.85';
        return 'comment';
      },
    };
    const github = createMockGithub();
    (github.listOpenIssues as ReturnType<typeof vi.fn>).mockResolvedValue([
      { number: 1, title: 'app crashes on start', body: 'the app crashes when I start it' },
      { number: 5, title: 'app wont start up', body: 'tried installing but the app refuses to start' },
    ]);
    const config = createConfig();

    await handleIssueOpened(
      { issue: { number: 5, title: 'app wont start up', body: 'tried installing but the app refuses to start' } },
      ai,
      github,
      config,
    );

    expect(github.addLabels).toHaveBeenCalledWith(5, ['possible-duplicate']);
    // Should NOT close the issue — just flag it
    expect(github.closeIssue).not.toHaveBeenCalled();
  });
});
