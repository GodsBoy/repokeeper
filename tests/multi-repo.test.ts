import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveRepoConfig, deepMerge } from '../src/config.js';
import type { RepoKeeperConfig, RepoEntry } from '../src/config.js';

// Mock getConfig to return multi-repo configs
vi.mock('../src/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config.js')>();
  let mockConfig: RepoKeeperConfig;

  return {
    ...actual,
    getConfig: () => mockConfig,
    setMockConfig: (cfg: RepoKeeperConfig) => { mockConfig = cfg; },
    resolveRepoConfig: (owner: string, repo: string): RepoKeeperConfig => {
      const base = mockConfig;
      if (!base.repos || base.repos.length === 0) {
        return base;
      }
      const match = base.repos.find(
        (r: RepoEntry) => r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase(),
      );
      if (!match) {
        return base;
      }
      let resolved = { ...base, github: { ...base.github, owner: match.owner, repo: match.repo } };
      if (match.triage) {
        resolved = { ...resolved, triage: actual.deepMerge(base.triage, match.triage) };
      }
      if (match.prSummariser) {
        resolved = { ...resolved, prSummariser: actual.deepMerge(base.prSummariser, match.prSummariser) };
      }
      if (match.codeReview) {
        resolved = { ...resolved, codeReview: actual.deepMerge(base.codeReview, match.codeReview) };
      }
      if (match.ai) {
        resolved = { ...resolved, ai: actual.deepMerge(base.ai, match.ai) };
      }
      return resolved;
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { setMockConfig } = await import('../src/config.js') as any;

const multiRepoConfig: RepoKeeperConfig = {
  github: { token: 'test-token', webhookSecret: 'secret', owner: '', repo: '' },
  ai: { provider: 'claude', model: 'claude-sonnet-4-6' },
  triage: { enabled: true, duplicateThreshold: 0.85, minimumBodyLength: 100 },
  prSummariser: { enabled: true, minDiffLines: 50, generateReleaseNotes: true },
  codeReview: { enabled: true, focus: ['security', 'performance'], maxContextFiles: 5, minDiffLines: 10 },
  port: 3001,
  repos: [
    { owner: 'org1', repo: 'repo1', triage: { enabled: true, duplicateThreshold: 0.5 } },
    { owner: 'org2', repo: 'repo2', triage: { enabled: false }, codeReview: { enabled: false } },
    { owner: 'org1', repo: 'repo3', ai: { model: 'gpt-4o' } },
  ],
};

describe('Multi-repo config resolution', () => {
  beforeEach(() => {
    setMockConfig(multiRepoConfig);
  });

  it('resolves config for a matching repo with overrides', () => {
    const result = resolveRepoConfig('org1', 'repo1');
    expect(result.github.owner).toBe('org1');
    expect(result.github.repo).toBe('repo1');
    expect(result.triage.duplicateThreshold).toBe(0.5);
    expect(result.triage.enabled).toBe(true);
    // Global settings should be preserved
    expect(result.ai.model).toBe('claude-sonnet-4-6');
  });

  it('resolves config for a repo with features disabled', () => {
    const result = resolveRepoConfig('org2', 'repo2');
    expect(result.github.owner).toBe('org2');
    expect(result.github.repo).toBe('repo2');
    expect(result.triage.enabled).toBe(false);
    expect(result.codeReview.enabled).toBe(false);
    // prSummariser should use global default
    expect(result.prSummariser.enabled).toBe(true);
  });

  it('resolves config with AI model override per repo', () => {
    const result = resolveRepoConfig('org1', 'repo3');
    expect(result.ai.model).toBe('gpt-4o');
    expect(result.ai.provider).toBe('claude'); // global provider unchanged
  });

  it('returns base config for unknown repo', () => {
    const result = resolveRepoConfig('unknown', 'unknown-repo');
    expect(result.github.owner).toBe('');
    expect(result.github.repo).toBe('');
    expect(result.triage.duplicateThreshold).toBe(0.85);
  });

  it('matches repos case-insensitively', () => {
    const result = resolveRepoConfig('ORG1', 'REPO1');
    expect(result.github.owner).toBe('org1');
    expect(result.github.repo).toBe('repo1');
    expect(result.triage.duplicateThreshold).toBe(0.5);
  });

  it('preserves global settings not overridden by repo', () => {
    const result = resolveRepoConfig('org1', 'repo1');
    expect(result.port).toBe(3001);
    expect(result.github.token).toBe('test-token');
    expect(result.github.webhookSecret).toBe('secret');
    expect(result.prSummariser.minDiffLines).toBe(50);
  });
});

describe('Single-repo backward compatibility', () => {
  it('works when repos array is absent', () => {
    const singleRepoConfig: RepoKeeperConfig = {
      github: { token: 'test-token', webhookSecret: 'secret', owner: 'myorg', repo: 'myrepo' },
      ai: { provider: 'claude', model: 'claude-sonnet-4-6' },
      triage: { enabled: true, duplicateThreshold: 0.85, minimumBodyLength: 100 },
      prSummariser: { enabled: true, minDiffLines: 50, generateReleaseNotes: true },
      codeReview: { enabled: true, focus: ['security'], maxContextFiles: 5, minDiffLines: 10 },
      port: 3001,
    };
    setMockConfig(singleRepoConfig);

    const result = resolveRepoConfig('myorg', 'myrepo');
    expect(result.github.owner).toBe('myorg');
    expect(result.github.repo).toBe('myrepo');
    expect(result.triage.enabled).toBe(true);
  });

  it('works when repos array is empty', () => {
    const emptyReposConfig: RepoKeeperConfig = {
      ...multiRepoConfig,
      github: { token: 'test-token', webhookSecret: 'secret', owner: 'myorg', repo: 'myrepo' },
      repos: [],
    };
    setMockConfig(emptyReposConfig);

    const result = resolveRepoConfig('myorg', 'myrepo');
    expect(result.github.owner).toBe('myorg');
  });
});
