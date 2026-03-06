export interface SimilarIssue {
  number: number;
  title: string;
  score: number;
}

export function findDuplicates(
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
