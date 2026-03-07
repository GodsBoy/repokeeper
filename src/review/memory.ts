import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { log } from '../logger.js';
import type { ReviewMemoryEntry } from './types.js';

const MEMORY_PATH = '/tmp/repokeeper-cache/review-memory.json';

function loadMemory(): ReviewMemoryEntry[] {
  if (!existsSync(MEMORY_PATH)) return [];
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMemory(entries: ReviewMemoryEntry[]): void {
  const dir = dirname(MEMORY_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(MEMORY_PATH, JSON.stringify(entries, null, 2));
}

export function getAcceptedPatterns(): ReviewMemoryEntry[] {
  return loadMemory();
}

export function addAcceptedPattern(pattern: string, prNumber: number): void {
  const entries = loadMemory();
  // Avoid duplicates
  if (entries.some((e) => e.pattern === pattern)) return;
  entries.push({
    pattern,
    acceptedAt: new Date().toISOString(),
    prNumber,
  });
  saveMemory(entries);
  log('info', `Stored accepted pattern from PR #${prNumber}`);
}

export function learnFromMergedPR(
  reviewComments: Array<{ body: string }>,
  prNumber: number,
): void {
  // Extract patterns from review comments that were on a merged PR
  // (meaning the code was accepted despite the review comment)
  for (const comment of reviewComments) {
    // Only learn from RepoKeeper's own review comments
    if (!comment.body.includes('RepoKeeper') && !comment.body.includes('SUGGESTION') && !comment.body.includes('WARNING')) {
      continue;
    }

    // Extract the core message (skip severity prefix/emoji)
    const lines = comment.body.split('\n').filter((l) => l.trim().length > 0);
    const meaningful = lines.find((l) => !l.startsWith('#') && !l.startsWith('*') && !l.startsWith('---'));
    if (meaningful && meaningful.length > 10) {
      addAcceptedPattern(meaningful.trim(), prNumber);
    }
  }
}

export function formatAcceptedPatternsPrompt(patterns: ReviewMemoryEntry[]): string {
  if (patterns.length === 0) return '';

  const patternList = patterns
    .slice(-20) // Only include the 20 most recent
    .map((p) => `- ${p.pattern}`)
    .join('\n');

  return (
    `\n\nIMPORTANT: The following patterns have been previously reviewed and accepted by the maintainers. ` +
    `Do NOT flag these as issues:\n${patternList}\n`
  );
}
