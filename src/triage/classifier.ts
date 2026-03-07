import type { AIProvider } from '../ai/provider.js';

export type IssueCategory = 'bug' | 'feature' | 'question' | 'duplicate' | 'docs' | 'invalid' | 'needs-more-info';

const CLASSIFY_PROMPT = `You are a GitHub issue classifier. Classify the following issue into exactly ONE category.

Categories:
- bug: Something is broken or not working as expected
- feature: A request for new functionality or enhancement
- question: A question about usage, setup, or behaviour
- docs: A request to improve or fix documentation
- invalid: Spam, off-topic, or not actionable

Respond with ONLY the category name (one word, lowercase). Nothing else.

Issue title: {title}
Issue body: {body}`;

export function isVagueIssue(body: string): boolean {
  const trimmed = body.trim();

  // Check for technical quality signals
  const hasCodeBlocks = /```[\s\S]*?```/.test(trimmed) || /`[^`]+`/.test(trimmed);
  const hasErrorIndicators = /error|exception|stack|traceback|at\s+\S+\s*\(/i.test(trimmed);
  const hasSteps = /step|reproduc|to reproduce|how to|expected|actual/i.test(trimmed);
  const hasTechnicalDetail = hasCodeBlocks || hasErrorIndicators || hasSteps;

  // If the body has technical indicators, it's not vague regardless of length
  if (hasTechnicalDetail) return false;

  // Short body without technical detail is vague
  if (trimmed.length < 100) return true;

  // Count sentences (rough: split on . ! ?)
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 5);

  // Fewer than 3 sentences with no technical detail → vague
  if (sentences.length < 3) return true;

  return false;
}

export async function classifyIssue(
  title: string,
  body: string,
  ai: AIProvider,
): Promise<IssueCategory> {
  // If the issue is too vague to classify meaningfully, don't even ask the AI
  if (isVagueIssue(body)) {
    return 'needs-more-info';
  }

  const prompt = CLASSIFY_PROMPT.replace('{title}', title).replace('{body}', body || '(empty)');
  const result = (await ai.complete(prompt)).trim().toLowerCase();

  const valid: IssueCategory[] = ['bug', 'feature', 'question', 'duplicate', 'docs', 'invalid'];
  if (valid.includes(result as IssueCategory)) {
    return result as IssueCategory;
  }

  // Fallback: try to find a category keyword in the response
  for (const cat of valid) {
    if (result.includes(cat)) return cat;
  }

  return 'question';
}

export function categoryToLabel(category: IssueCategory): string {
  switch (category) {
    case 'bug':
      return 'bug';
    case 'feature':
      return 'enhancement';
    case 'question':
      return 'question';
    case 'duplicate':
      return 'duplicate';
    case 'docs':
      return 'documentation';
    case 'invalid':
      return 'invalid';
    case 'needs-more-info':
      return 'needs-more-info';
  }
}
