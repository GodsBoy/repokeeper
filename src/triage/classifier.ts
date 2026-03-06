import type { AIProvider } from '../ai/provider.js';

export type IssueCategory = 'bug' | 'feature' | 'question' | 'duplicate' | 'docs' | 'invalid';

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

export async function classifyIssue(
  title: string,
  body: string,
  ai: AIProvider,
): Promise<IssueCategory> {
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
  }
}
