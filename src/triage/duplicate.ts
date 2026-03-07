import type { AIProvider } from '../ai/provider.js';
import { log } from '../logger.js';

export interface SimilarIssue {
  number: number;
  title: string;
  score: number;
}

const SIMILARITY_PROMPT = `You are a duplicate issue detector for a GitHub repository. Compare the two issues below and rate how likely they describe the SAME underlying problem or request.

Score from 0.0 to 1.0:
0.0 = completely unrelated topics
0.3 = vaguely related but clearly different issues
0.5 = related topic but different specific problems
0.7 = very likely the same issue, just described differently
0.9 = almost certainly the same issue
1.0 = exact duplicate

Consider semantic meaning, not just word overlap. Two issues can describe the same problem using completely different words.
For example: "app won't start" and "nothing works after install" are likely the same problem (both about installation/startup failure).

NEW ISSUE:
Title: {newTitle}
Body: {newBody}

EXISTING ISSUE:
Title: {existingTitle}
Body: {existingBody}

Respond with ONLY a single decimal number between 0.0 and 1.0. Nothing else.`;

// Maximum number of open issues to send to AI without pre-filtering
const AI_DIRECT_THRESHOLD = 30;

export async function findDuplicates(
  title: string,
  body: string,
  openIssues: Array<{ number: number; title: string; body: string | null }>,
  threshold: number,
  ai?: AIProvider,
): Promise<SimilarIssue[]> {
  if (ai) {
    try {
      return await findDuplicatesWithAI(title, body, openIssues, threshold, ai);
    } catch (err) {
      log('warn', 'AI duplicate detection failed, falling back to Jaccard', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return findDuplicatesJaccard(title, body, openIssues, threshold);
}

async function findDuplicatesWithAI(
  title: string,
  body: string,
  openIssues: Array<{ number: number; title: string; body: string | null }>,
  threshold: number,
  ai: AIProvider,
): Promise<SimilarIssue[]> {
  let candidates: Array<{ number: number; title: string; body: string | null }>;

  if (openIssues.length <= AI_DIRECT_THRESHOLD) {
    // Small repo: send all issues to AI directly (no Jaccard pre-filter)
    candidates = openIssues;
  } else {
    // Large repo: use a very low Jaccard pre-filter to narrow down candidates
    const jaccardCandidates = findDuplicatesJaccard(title, body, openIssues, 0.05);
    if (jaccardCandidates.length === 0) {
      // Even at the lowest bar nothing matched — still send top N by keyword overlap
      candidates = openIssues.slice(0, AI_DIRECT_THRESHOLD);
    } else {
      candidates = jaccardCandidates.map((c) => {
        const issue = openIssues.find((i) => i.number === c.number);
        return issue!;
      });
    }
  }

  const results: SimilarIssue[] = [];

  for (const candidate of candidates) {
    const prompt = SIMILARITY_PROMPT.replace('{newTitle}', title)
      .replace('{newBody}', body || '(empty)')
      .replace('{existingTitle}', candidate.title)
      .replace('{existingBody}', candidate.body || '(empty)');

    const response = (await ai.complete(prompt)).trim();
    const score = parseFloat(response);

    if (!isNaN(score) && score >= 0 && score <= 1 && score >= threshold) {
      results.push({ number: candidate.number, title: candidate.title, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function findDuplicatesJaccard(
  title: string,
  body: string,
  openIssues: Array<{ number: number; title: string; body: string | null }>,
  threshold: number,
): SimilarIssue[] {
  const inputTokens = tokenize(`${title} ${body}`);

  return openIssues
    .map((issue) => {
      const issueTokens = tokenize(`${issue.title} ${issue.body ?? ''}`);
      const score = jaccardSimilarity(inputTokens, issueTokens);
      return { number: issue.number, title: issue.title, score };
    })
    .filter((match) => match.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
