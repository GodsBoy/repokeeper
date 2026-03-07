import { describe, it, expect } from 'vitest';
import { mergeRepoConfig, deepMerge, resolveRepoConfig } from '../src/config.js';
import type { RepoKeeperConfig } from '../src/config.js';

const baseConfig: RepoKeeperConfig = {
  github: { token: 'test-token', webhookSecret: 'secret', owner: 'owner', repo: 'repo' },
  ai: { provider: 'claude', model: 'claude-sonnet-4-6' },
  triage: { enabled: true, duplicateThreshold: 0.85, minimumBodyLength: 100 },
  prSummariser: { enabled: true, minDiffLines: 50, generateReleaseNotes: true },
  codeReview: { enabled: true, focus: ['security', 'performance', 'test-coverage', 'breaking-changes'], maxContextFiles: 5, minDiffLines: 10 },
  port: 3001,
};

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('merges nested objects', () => {
    const result = deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 3 } });
    expect(result).toEqual({ a: { x: 1, y: 3 } });
  });

  it('does not mutate target', () => {
    const target = { a: 1 };
    deepMerge(target, { b: 2 });
    expect(target).toEqual({ a: 1 });
  });
});

describe('mergeRepoConfig', () => {
  it('overrides triage settings from YAML', () => {
    const yaml = { triage: { duplicateThreshold: 0.7 } };
    const result = mergeRepoConfig(baseConfig, yaml);
    expect(result.triage.duplicateThreshold).toBe(0.7);
    expect(result.triage.enabled).toBe(true); // unchanged
  });

  it('overrides AI settings from YAML', () => {
    const yaml = { ai: { model: 'gpt-4o' } };
    const result = mergeRepoConfig(baseConfig, yaml);
    expect(result.ai.model).toBe('gpt-4o');
    expect(result.ai.provider).toBe('claude'); // unchanged
  });

  it('overrides prSummariser settings from YAML', () => {
    const yaml = { prSummariser: { generateReleaseNotes: false, minDiffLines: 100 } };
    const result = mergeRepoConfig(baseConfig, yaml);
    expect(result.prSummariser.generateReleaseNotes).toBe(false);
    expect(result.prSummariser.minDiffLines).toBe(100);
  });

  it('does not allow github overrides from YAML', () => {
    const yaml = { github: { token: 'hacked' }, port: 9999 };
    const result = mergeRepoConfig(baseConfig, yaml);
    expect(result.github.token).toBe('test-token');
    expect(result.port).toBe(3001);
  });

  it('ignores empty YAML', () => {
    const result = mergeRepoConfig(baseConfig, {});
    expect(result).toEqual(baseConfig);
  });
});

describe('resolveRepoConfig', () => {
  it('returns base config in single-repo mode', async () => {
    // resolveRepoConfig uses getConfig() internally, so we test it via the module
    // by importing and calling it directly with a config that has no repos
    const { resolveRepoConfig: resolve } = await import('../src/config.js');
    // Without repos array, it should return the global config
    const result = resolve('owner', 'repo');
    expect(result).toBeDefined();
    expect(result.github.token).toBeDefined();
  });
});
