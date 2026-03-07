import { describe, it, expect, vi } from 'vitest';
import { handlePullRequest, handlePullRequestMerged } from '../src/pr/summariser.js';
import type { AIProvider } from '../src/ai/provider.js';
import type { RepoKeeperConfig } from '../src/config.js';

function mockAI(response: string): AIProvider {
  return { complete: vi.fn().mockResolvedValue(response) };
}

function mockGitHub() {
  return {
    addLabels: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    closeIssue: vi.fn().mockResolvedValue(undefined),
    listOpenIssues: vi.fn().mockResolvedValue([]),
    getPRDiff: vi.fn().mockResolvedValue('diff --git a/file.ts b/file.ts\n+added line'),
    getPRFiles: vi.fn().mockResolvedValue([
      { filename: 'src/index.ts', additions: 10, deletions: 5, status: 'modified' },
    ]),
  };
}

const baseConfig: RepoKeeperConfig = {
  github: { token: 'test', webhookSecret: 'secret', owner: 'owner', repo: 'repo' },
  ai: { provider: 'claude', model: 'test-model' },
  triage: { enabled: true, duplicateThreshold: 0.85, minimumBodyLength: 100 },
  prSummariser: { enabled: true, minDiffLines: 5, generateReleaseNotes: true },
  port: 3001,
};

describe('handlePullRequest', () => {
  it('generates summary and labels PR', async () => {
    const ai = mockAI('This PR adds a new feature.');
    const github = mockGitHub();
    const payload = { pull_request: { number: 1, title: 'Add feature', body: 'Description' } };

    await handlePullRequest(payload, ai, github as never, baseConfig);

    expect(github.addLabels).toHaveBeenCalledWith(1, ['size/small']);
    expect(github.addComment).toHaveBeenCalledWith(1, expect.stringContaining('PR Summary'));
    expect(ai.complete).toHaveBeenCalled();
  });

  it('skips summary when below minDiffLines', async () => {
    const ai = mockAI('Summary');
    const github = mockGitHub();
    github.getPRFiles.mockResolvedValue([
      { filename: 'src/index.ts', additions: 1, deletions: 1, status: 'modified' },
    ]);
    const config = { ...baseConfig, prSummariser: { ...baseConfig.prSummariser, minDiffLines: 50 } };
    const payload = { pull_request: { number: 2, title: 'Small fix', body: null } };

    await handlePullRequest(payload, ai, github as never, config);

    expect(github.addLabels).toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(github.addComment).not.toHaveBeenCalled();
  });
});

describe('handlePullRequestMerged', () => {
  it('generates release notes for merged PR', async () => {
    const ai = mockAI('## v1.0\n- Added new feature');
    const github = mockGitHub();
    const payload = { pull_request: { number: 3, title: 'Add feature', body: 'New feature', merged: true } };

    await handlePullRequestMerged(payload, ai, github as never, baseConfig);

    expect(ai.complete).toHaveBeenCalled();
    expect(github.addComment).toHaveBeenCalledWith(3, expect.stringContaining('Release Notes'));
    expect(github.getPRFiles).toHaveBeenCalledWith(3);
  });

  it('skips release notes when disabled', async () => {
    const ai = mockAI('Notes');
    const github = mockGitHub();
    const config = { ...baseConfig, prSummariser: { ...baseConfig.prSummariser, generateReleaseNotes: false } };
    const payload = { pull_request: { number: 4, title: 'Fix', body: null, merged: true } };

    await handlePullRequestMerged(payload, ai, github as never, config);

    expect(ai.complete).not.toHaveBeenCalled();
    expect(github.addComment).not.toHaveBeenCalled();
  });
});
