import { Octokit } from '@octokit/rest';
import type { AIProvider } from '../ai/provider.js';
import type { GitHubClient } from '../github/client.js';
import type { RepoKeeperConfig } from '../config.js';
import { log } from '../logger.js';
import { buildContext } from './context-builder.js';
import { postReview } from './comment-poster.js';
import { isAlreadyReviewed, markReviewed, parseDiffHunks, cleanupPR } from './hunk-tracker.js';
import { getAcceptedPatterns, formatAcceptedPatternsPrompt, learnFromMergedPR } from './memory.js';
import type { PRReviewPayload, ReviewResult, ReviewFinding, CodeReviewConfig, EnrichedFile } from './types.js';

const DEFAULT_REVIEW_CONFIG: CodeReviewConfig = {
  enabled: true,
  focus: ['security', 'performance', 'test-coverage', 'breaking-changes'],
  maxContextFiles: 5,
  minDiffLines: 10,
};

function buildReviewPrompt(
  diff: string,
  enrichedFiles: EnrichedFile[],
  config: CodeReviewConfig,
  acceptedPatterns: string,
): string {
  const focusInstructions = config.focus
    .map((f) => {
      switch (f) {
        case 'security': return '- SECURITY: Look for injection vulnerabilities, hardcoded secrets, unsafe input handling, XSS, CSRF, and auth issues';
        case 'performance': return '- PERFORMANCE: Look for N+1 queries, unbounded loops, missing pagination, unnecessary re-renders, or expensive operations in hot paths';
        case 'test-coverage': return '- TEST COVERAGE: Identify new functions/methods/classes that have no corresponding test file or test case. Flag each with the function name, file, and suggest a test approach';
        case 'breaking-changes': return '- BREAKING CHANGES: Look for removed exports, changed function signatures, renamed fields, or modified public API contracts';
        default: return `- ${f.toUpperCase()}: Review for ${f} issues`;
      }
    })
    .join('\n');

  let contextSection = '';
  if (enrichedFiles.length > 0) {
    contextSection = '\n\n## Codebase Context (dependency files for changed files)\n';
    for (const ef of enrichedFiles) {
      if (ef.dependencies.length > 0) {
        contextSection += `\n### Dependencies of ${ef.changedFile}:\n`;
        for (const dep of ef.dependencies) {
          contextSection += `\n#### ${dep.path}\n\`\`\`\n${dep.content.slice(0, 3000)}\n\`\`\`\n`;
        }
      }
    }
  }

  return `You are an expert code reviewer. Review the following pull request diff carefully.

## Review Focus Areas
${focusInstructions}

## Diff to Review
\`\`\`diff
${diff}
\`\`\`
${contextSection}${acceptedPatterns}

## Instructions
Respond with a JSON object (no markdown fencing, pure JSON) with this exact structure:
{
  "summary": "2-3 sentence summary of the review",
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "BLOCKING" | "WARNING" | "SUGGESTION",
      "message": "Description of the issue and how to fix it"
    }
  ]
}

Severity levels:
- BLOCKING: Must fix before merge (security vulnerabilities, data loss, crashes)
- WARNING: Should fix but not a blocker (code smells, missing error handling)
- SUGGESTION: Nice to have (style improvements, test gaps, refactoring ideas)

If there are no issues, return {"summary": "...", "findings": []}.
Return ONLY the JSON object, nothing else.`;
}

function parseAIResponse(response: string): ReviewResult {
  // Try to extract JSON from the response
  let jsonStr = response.trim();

  // Remove markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const findings: ReviewFinding[] = (parsed.findings ?? []).map((f: Record<string, unknown>) => ({
      file: String(f.file ?? ''),
      line: Number(f.line ?? 1),
      severity: ['BLOCKING', 'WARNING', 'SUGGESTION'].includes(String(f.severity))
        ? String(f.severity) as ReviewFinding['severity']
        : 'SUGGESTION',
      message: String(f.message ?? ''),
    }));

    return {
      summary: String(parsed.summary ?? 'Review complete.'),
      findings,
    };
  } catch {
    log('warn', 'Failed to parse AI review response as JSON, returning as summary');
    return {
      summary: response.slice(0, 500),
      findings: [],
    };
  }
}

export async function handleCodeReview(
  payload: PRReviewPayload,
  ai: AIProvider,
  github: GitHubClient,
  config: RepoKeeperConfig,
): Promise<void> {
  const reviewConfig = config.codeReview ?? DEFAULT_REVIEW_CONFIG;
  if (!reviewConfig.enabled) {
    log('info', 'Code review is disabled');
    return;
  }

  const { pull_request: pr, repository } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const headSha = pr.head.sha;
  const prNumber = pr.number;

  // Check if already reviewed this SHA
  if (isAlreadyReviewed(owner, repo, prNumber, headSha)) {
    log('info', `PR #${prNumber} SHA ${headSha.slice(0, 7)} already reviewed, skipping`);
    return;
  }

  log('info', `Starting code review for PR #${prNumber}`);

  // Get diff
  const diff = await github.getPRDiff(prNumber);
  const hunks = parseDiffHunks(diff);
  const totalAddedLines = hunks.reduce((sum, h) => sum + h.lineCount, 0);

  if (totalAddedLines < reviewConfig.minDiffLines) {
    log('info', `PR #${prNumber} has ${totalAddedLines} added lines — below minDiffLines (${reviewConfig.minDiffLines}), skipping review`);
    return;
  }

  // Get changed file names from hunks
  const changedFiles = [...new Set(hunks.map((h) => h.file))];

  // Build codebase context
  let enrichedFiles: EnrichedFile[] = [];
  try {
    enrichedFiles = await buildContext(
      changedFiles,
      repository.clone_url,
      owner,
      repo,
      pr.base.sha,
      reviewConfig.maxContextFiles,
    );
  } catch (err) {
    log('warn', 'Failed to build codebase context, proceeding without it', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Get accepted patterns from memory
  const acceptedPatterns = formatAcceptedPatternsPrompt(getAcceptedPatterns());

  // Truncate diff for AI
  const maxDiffChars = 30_000;
  const truncatedDiff = diff.length > maxDiffChars
    ? diff.slice(0, maxDiffChars) + '\n\n... (diff truncated)'
    : diff;

  // Build prompt and call AI
  const prompt = buildReviewPrompt(truncatedDiff, enrichedFiles, reviewConfig, acceptedPatterns);
  const aiResponse = await ai.complete(prompt);
  const result = parseAIResponse(aiResponse);

  // Post review via GitHub API
  const octokit = new Octokit({ auth: config.github.token });
  await postReview(octokit, owner, repo, prNumber, headSha, result);

  // Mark this SHA as reviewed
  markReviewed(owner, repo, prNumber, headSha);

  log('info', `Code review complete for PR #${prNumber}: ${result.findings.length} finding(s)`);
}

export async function handleCodeReviewMerged(
  payload: PRReviewPayload,
  config: RepoKeeperConfig,
): Promise<void> {
  const { pull_request: pr, repository } = payload;
  const owner = repository.owner.login;
  const repo = repository.name;
  const prNumber = pr.number;

  log('info', `PR #${prNumber} merged, learning from review comments`);

  const octokit = new Octokit({ auth: config.github.token });

  try {
    const { getReviewComments } = await import('./comment-poster.js');
    const comments = await getReviewComments(octokit, owner, repo, prNumber);
    learnFromMergedPR(comments, prNumber);
  } catch (err) {
    log('warn', 'Failed to learn from merged PR review comments', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Clean up tracked SHAs for this PR
  cleanupPR(owner, repo, prNumber);
}
