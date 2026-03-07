import { Octokit } from '@octokit/rest';
import { log } from '../logger.js';
import type { ReviewFinding, ReviewResult } from './types.js';

type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

function severityEmoji(severity: string): string {
  switch (severity) {
    case 'BLOCKING': return '🚨';
    case 'WARNING': return '⚠️';
    case 'SUGGESTION': return '💡';
    default: return '📝';
  }
}

function determineEvent(findings: ReviewFinding[]): ReviewEvent {
  if (findings.length === 0) return 'APPROVE';
  if (findings.some((f) => f.severity === 'BLOCKING')) return 'REQUEST_CHANGES';
  return 'COMMENT';
}

function buildReviewBody(result: ReviewResult): string {
  if (result.findings.length === 0) {
    return `## RepoKeeper Code Review\n\n${result.summary}\n\nNo issues found. Looks good! ✅`;
  }

  const blocking = result.findings.filter((f) => f.severity === 'BLOCKING');
  const warnings = result.findings.filter((f) => f.severity === 'WARNING');
  const suggestions = result.findings.filter((f) => f.severity === 'SUGGESTION');

  let body = `## RepoKeeper Code Review\n\n${result.summary}\n\n`;
  body += `**Found ${result.findings.length} issue(s):** `;
  body += `${blocking.length} blocking, ${warnings.length} warning(s), ${suggestions.length} suggestion(s)\n\n`;
  body += `---\n*Review by [RepoKeeper](https://github.com/GodsBoy/repokeeper)*`;

  return body;
}

function buildComments(findings: ReviewFinding[]): ReviewComment[] {
  return findings.map((f) => ({
    path: f.file,
    line: f.line,
    body: `${severityEmoji(f.severity)} **${f.severity}**\n\n${f.message}`,
  }));
}

export async function postReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  commitSha: string,
  result: ReviewResult,
): Promise<void> {
  const event = determineEvent(result.findings);
  const body = buildReviewBody(result);
  const comments = buildComments(result.findings);

  try {
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitSha,
      event,
      body,
      comments,
    });
    log('info', `Posted ${event} review on PR #${pullNumber} with ${comments.length} inline comment(s)`);
  } catch (err) {
    // GitHub rejects REQUEST_CHANGES on your own PR — fall back to COMMENT
    const message = err instanceof Error ? err.message : String(err);
    if (event === 'REQUEST_CHANGES' && message.includes('own pull request')) {
      log('warn', `Cannot request changes on own PR #${pullNumber}, falling back to COMMENT event`);
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitSha,
        event: 'COMMENT',
        body,
        comments,
      });
      log('info', `Posted COMMENT review on PR #${pullNumber} with ${comments.length} inline comment(s)`);
    } else {
      throw err;
    }
  }
}

export async function getReviewComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<Array<{ id: number; body: string; path: string; line: number | null }>> {
  const comments = await octokit.paginate(octokit.pulls.listReviewComments, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    path: c.path,
    line: c.line ?? null,
  }));
}
