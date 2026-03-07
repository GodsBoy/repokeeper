import type { AIProvider } from '../ai/provider.js';
import { log } from '../logger.js';

export interface SimilarIssue {
  number: number;
  title: string;
  score: number;
}

const SIMILARITY_PROMPT = `You are a duplicate issue detector. Compare the two GitHub issues below and rate their semantic similarity on a scale from 0.0 to 1.0.

0.0 = completely unrelated
0.5 = somewhat related but different issues
0.8 = very similar, likely the same problem
1.0 = exact duplicate

NEW ISSUE:
Title: {newTitle}
Body: {newBody}

EXISTING ISSUE:
Title: {existingTitle}
Body: {existingBody}

Respond with ONLY a single decimal number between 0.0 and 1.0. Nothing else.`;

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
  // Pre-filter with a lower Jaccard threshold to avoid sending every issue to the AI
  const candidates = findDuplicatesJaccard(title, body, openIssues, Math.max(0.1, threshold - 0.4));

  // If Jaccard finds nothing even at a low bar, no need to call AI
  if (candidates.length === 0) {
    return [];
  }

  const results: SimilarIssue[] = [];

  for (const candidate of candidates) {
    const existingIssue = openIssues.find((i) => i.number === candidate.number);
    if (!existingIssue) continue;

    const prompt = SIMILARITY_PROMPT.replace('{newTitle}', title)
      .replace('{newBody}', body || '(empty)')
      .replace('{existingTitle}', existingIssue.title)
      .replace('{existingBody}', existingIssue.body || '(empty)');

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
