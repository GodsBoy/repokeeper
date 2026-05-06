import { describe, expect, it } from 'vitest';
import type { RepoKeeperConfig } from '../src/config.js';
import { getEnabledWorkflows, hasWorkflowForEvent } from '../src/webhook/router.js';

const baseConfig: RepoKeeperConfig = {
  github: { token: 'test-token', webhookSecret: 'secret', owner: 'owner', repo: 'repo' },
  ai: { provider: 'claude', model: 'claude-sonnet-4-6' },
  triage: { enabled: true, duplicateThreshold: 0.85, minimumBodyLength: 100 },
  prSummariser: { enabled: true, minDiffLines: 50, generateReleaseNotes: true },
  codeReview: {
    enabled: true,
    focus: ['security', 'performance', 'test-coverage', 'breaking-changes'],
    maxContextFiles: 5,
    minDiffLines: 10,
  },
  attribution: { enabled: true },
  port: 3001,
};

function actionsFor(eventKey: string, config: RepoKeeperConfig = baseConfig, payload: unknown = {}) {
  return getEnabledWorkflows(eventKey, config, payload).map((workflow) => workflow.action);
}

describe('getEnabledWorkflows', () => {
  it('routes opened issues to triage when triage is enabled', () => {
    expect(actionsFor('issues.opened')).toEqual(['issue.triage']);
  });

  it('skips opened issue triage when triage is disabled', () => {
    const config = { ...baseConfig, triage: { ...baseConfig.triage, enabled: false } };

    expect(actionsFor('issues.opened', config)).toEqual([]);
  });

  it('preserves the edited issue no-op lane', () => {
    expect(actionsFor('issues.edited')).toEqual(['issue.noop']);
  });

  it('runs summary and review lanes for opened pull requests', () => {
    expect(actionsFor('pull_request.opened')).toEqual(['pr.summarise', 'pr.review']);
  });

  it('runs summary and review lanes for synchronized pull requests', () => {
    expect(actionsFor('pull_request.synchronize')).toEqual(['pr.summarise', 'pr.review']);
  });

  it('respects PR summary and review feature flags independently', () => {
    const config = {
      ...baseConfig,
      prSummariser: { ...baseConfig.prSummariser, enabled: false },
      codeReview: { ...baseConfig.codeReview, enabled: true },
    };

    expect(actionsFor('pull_request.opened', config)).toEqual(['pr.review']);
  });

  it('runs merged PR lanes only when the closed PR was merged', () => {
    const payload = { pull_request: { merged: true } };

    expect(actionsFor('pull_request.closed', baseConfig, payload)).toEqual([
      'pr.releaseNotes',
      'pr.reviewMemory',
    ]);
  });

  it('skips merged PR lanes when the closed PR was not merged', () => {
    const payload = { pull_request: { merged: false } };

    expect(actionsFor('pull_request.closed', baseConfig, payload)).toEqual([]);
  });

  it('returns no workflows for unknown events', () => {
    expect(actionsFor('star.created')).toEqual([]);
  });

  it('distinguishes known events from unknown events even when no lane is enabled', () => {
    expect(hasWorkflowForEvent('pull_request.closed')).toBe(true);
    expect(hasWorkflowForEvent('star.created')).toBe(false);
  });
});
