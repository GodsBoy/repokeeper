import type { RepoKeeperConfig } from '../config.js';

export type WorkflowAction =
  | 'issue.triage'
  | 'issue.noop'
  | 'pr.summarise'
  | 'pr.review'
  | 'pr.releaseNotes'
  | 'pr.reviewMemory';

export interface WorkflowDefinition {
  id: string;
  events: string[];
  action: WorkflowAction;
  isEnabled: (config: RepoKeeperConfig, payload: unknown) => boolean;
}

export interface WorkflowRun {
  id: string;
  action: WorkflowAction;
}

export const DEFAULT_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'issue-triage',
    events: ['issues.opened'],
    action: 'issue.triage',
    isEnabled: (config) => config.triage.enabled,
  },
  {
    id: 'issue-edited-noop',
    events: ['issues.edited'],
    action: 'issue.noop',
    isEnabled: () => true,
  },
  {
    id: 'pr-summary',
    events: ['pull_request.opened', 'pull_request.synchronize'],
    action: 'pr.summarise',
    isEnabled: (config) => config.prSummariser.enabled,
  },
  {
    id: 'pr-review',
    events: ['pull_request.opened', 'pull_request.synchronize'],
    action: 'pr.review',
    isEnabled: (config) => config.codeReview.enabled,
  },
  {
    id: 'pr-release-notes',
    events: ['pull_request.closed'],
    action: 'pr.releaseNotes',
    isEnabled: (config, payload) => config.prSummariser.enabled && isMergedPullRequestPayload(payload),
  },
  {
    id: 'pr-review-memory',
    events: ['pull_request.closed'],
    action: 'pr.reviewMemory',
    isEnabled: (config, payload) => config.codeReview.enabled && isMergedPullRequestPayload(payload),
  },
];

export function getEnabledWorkflows(
  eventKey: string,
  config: RepoKeeperConfig,
  payload: unknown,
  workflows: WorkflowDefinition[] = DEFAULT_WORKFLOWS,
): WorkflowRun[] {
  return workflows
    .filter((workflow) => workflow.events.includes(eventKey) && workflow.isEnabled(config, payload))
    .map((workflow) => ({ id: workflow.id, action: workflow.action }));
}

export function hasWorkflowForEvent(
  eventKey: string,
  workflows: WorkflowDefinition[] = DEFAULT_WORKFLOWS,
): boolean {
  return workflows.some((workflow) => workflow.events.includes(eventKey));
}

function isMergedPullRequestPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const pullRequest = (payload as { pull_request?: { merged?: unknown } }).pull_request;
  return pullRequest?.merged === true;
}
