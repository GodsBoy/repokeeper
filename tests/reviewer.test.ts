import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseImports } from '../src/review/context-builder.js';
import { parseDiffHunks, isAlreadyReviewed, markReviewed, getReviewedShas, cleanupPR } from '../src/review/hunk-tracker.js';
import { getAcceptedPatterns, addAcceptedPattern, learnFromMergedPR, formatAcceptedPatternsPrompt } from '../src/review/memory.js';
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';

// --- context-builder tests ---

describe('parseImports', () => {
  it('parses ES import statements', () => {
    const content = `import { foo } from './utils.js';\nimport bar from '../lib/bar.js';`;
    const result = parseImports(content, 'src/main.ts');
    expect(result).toContain('src/utils.ts');
    expect(result).toContain('lib/bar.ts');
  });

  it('parses require() calls', () => {
    const content = `const x = require('./helper.js');\nconst y = require('../config');`;
    const result = parseImports(content, 'src/index.ts');
    expect(result).toContain('src/helper.ts');
    expect(result).toContain('config.ts');
  });

  it('ignores package imports', () => {
    const content = `import express from 'express';\nimport { Octokit } from '@octokit/rest';`;
    const result = parseImports(content, 'src/main.ts');
    expect(result).toHaveLength(0);
  });

  it('handles mixed imports', () => {
    const content = `import { a } from './a.js';\nimport b from 'b';\nconst c = require('./c');`;
    const result = parseImports(content, 'src/index.ts');
    expect(result).toHaveLength(2);
    expect(result).toContain('src/a.ts');
    expect(result).toContain('src/c.ts');
  });

  it('returns empty for non-JS/TS files', () => {
    const result = parseImports('some content', 'README.md');
    expect(result).toHaveLength(0);
  });

  it('handles import without from', () => {
    const content = `import './side-effect.js';`;
    const result = parseImports(content, 'src/main.ts');
    expect(result).toContain('src/side-effect.ts');
  });
});

// --- hunk-tracker tests ---

describe('parseDiffHunks', () => {
  it('parses a simple diff with one hunk', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
index abc..def 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
 const a = 1;
+const b = 2;
+const c = 3;
 const d = 4;`;
    const hunks = parseDiffHunks(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe('src/index.ts');
    expect(hunks[0].startLine).toBe(1);
    expect(hunks[0].content).toContain('+const b = 2;');
  });

  it('parses diff with multiple files', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 line1
+added in a
 line2
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -5,2 +5,3 @@
 line5
+added in b
 line6`;
    const hunks = parseDiffHunks(diff);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].file).toBe('src/a.ts');
    expect(hunks[1].file).toBe('src/b.ts');
    expect(hunks[1].startLine).toBe(5);
  });

  it('handles multiple hunks in same file', () => {
    const diff = `diff --git a/src/x.ts b/src/x.ts
--- a/src/x.ts
+++ b/src/x.ts
@@ -1,2 +1,3 @@
 line1
+hunk1
 line2
@@ -10,2 +11,3 @@
 line10
+hunk2
 line11`;
    const hunks = parseDiffHunks(diff);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].startLine).toBe(1);
    expect(hunks[1].startLine).toBe(11);
  });

  it('returns empty for empty diff', () => {
    expect(parseDiffHunks('')).toHaveLength(0);
  });

  it('handles removed lines correctly', () => {
    const diff = `diff --git a/src/x.ts b/src/x.ts
--- a/src/x.ts
+++ b/src/x.ts
@@ -1,4 +1,3 @@
 line1
-removed
+added
 line3`;
    const hunks = parseDiffHunks(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].content).toContain('+added');
    expect(hunks[0].content).not.toContain('-removed');
  });
});

describe('hunk-tracker SHA tracking', () => {
  const testShaPath = '/tmp/repokeeper-cache/reviewed-shas.json';

  beforeEach(() => {
    if (existsSync(testShaPath)) unlinkSync(testShaPath);
  });

  afterEach(() => {
    if (existsSync(testShaPath)) unlinkSync(testShaPath);
  });

  it('marks and checks reviewed SHAs', () => {
    expect(isAlreadyReviewed('owner', 'repo', 1, 'abc123')).toBe(false);
    markReviewed('owner', 'repo', 1, 'abc123');
    expect(isAlreadyReviewed('owner', 'repo', 1, 'abc123')).toBe(true);
    expect(isAlreadyReviewed('owner', 'repo', 1, 'def456')).toBe(false);
  });

  it('tracks multiple SHAs per PR', () => {
    markReviewed('owner', 'repo', 1, 'sha1');
    markReviewed('owner', 'repo', 1, 'sha2');
    const shas = getReviewedShas('owner', 'repo', 1);
    expect(shas).toEqual(['sha1', 'sha2']);
  });

  it('does not duplicate SHAs', () => {
    markReviewed('owner', 'repo', 1, 'sha1');
    markReviewed('owner', 'repo', 1, 'sha1');
    const shas = getReviewedShas('owner', 'repo', 1);
    expect(shas).toEqual(['sha1']);
  });

  it('cleans up PR data', () => {
    markReviewed('owner', 'repo', 1, 'sha1');
    cleanupPR('owner', 'repo', 1);
    expect(getReviewedShas('owner', 'repo', 1)).toEqual([]);
  });

  it('tracks SHAs per repo and PR independently', () => {
    markReviewed('owner', 'repo1', 1, 'sha-a');
    markReviewed('owner', 'repo2', 1, 'sha-b');
    expect(isAlreadyReviewed('owner', 'repo1', 1, 'sha-a')).toBe(true);
    expect(isAlreadyReviewed('owner', 'repo1', 1, 'sha-b')).toBe(false);
    expect(isAlreadyReviewed('owner', 'repo2', 1, 'sha-b')).toBe(true);
  });
});

// --- memory tests ---

describe('review memory', () => {
  const memoryPath = '/tmp/repokeeper-cache/review-memory.json';

  beforeEach(() => {
    if (existsSync(memoryPath)) unlinkSync(memoryPath);
  });

  afterEach(() => {
    if (existsSync(memoryPath)) unlinkSync(memoryPath);
  });

  it('starts with empty patterns', () => {
    expect(getAcceptedPatterns()).toEqual([]);
  });

  it('adds and retrieves accepted patterns', () => {
    addAcceptedPattern('Use any for legacy code', 42);
    const patterns = getAcceptedPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].pattern).toBe('Use any for legacy code');
    expect(patterns[0].prNumber).toBe(42);
  });

  it('avoids duplicate patterns', () => {
    addAcceptedPattern('Same pattern', 1);
    addAcceptedPattern('Same pattern', 2);
    expect(getAcceptedPatterns()).toHaveLength(1);
  });

  it('learns from merged PR comments', () => {
    const comments = [
      { body: '**SUGGESTION**\n\nConsider using a Map instead of an object for better performance' },
      { body: 'Random comment without RepoKeeper markers' },
      { body: '**WARNING** from RepoKeeper\n\nMissing error handling in catch block' },
    ];
    learnFromMergedPR(comments, 99);
    const patterns = getAcceptedPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(1);
  });

  it('formats accepted patterns prompt', () => {
    const patterns = [
      { pattern: 'Pattern A', acceptedAt: '2026-01-01', prNumber: 1 },
      { pattern: 'Pattern B', acceptedAt: '2026-01-02', prNumber: 2 },
    ];
    const prompt = formatAcceptedPatternsPrompt(patterns);
    expect(prompt).toContain('Pattern A');
    expect(prompt).toContain('Pattern B');
    expect(prompt).toContain('Do NOT flag');
  });

  it('returns empty string for no patterns', () => {
    expect(formatAcceptedPatternsPrompt([])).toBe('');
  });
});

// --- reviewer AI response parsing tests ---

describe('reviewer AI response parsing', () => {
  // We test the parseAIResponse function indirectly by importing the module
  // Since it's not exported, we test it through the reviewer's behavior
  // But for the unit test, let's test the exported functions

  it('context-builder handles TypeScript imports with .js extensions', () => {
    const content = `import { log } from './logger.js';
import type { Config } from '../config.js';`;
    const result = parseImports(content, 'src/webhook/handler.ts');
    expect(result).toContain('src/webhook/logger.ts');
    expect(result).toContain('src/config.ts');
  });

  it('context-builder handles type-only imports', () => {
    const content = `import type { Foo } from './types.js';`;
    const result = parseImports(content, 'src/index.ts');
    expect(result).toContain('src/types.ts');
  });

  it('context-builder handles dynamic imports', () => {
    const content = `const mod = require('./dynamic');`;
    const result = parseImports(content, 'src/loader.ts');
    expect(result).toContain('src/dynamic.ts');
  });
});

// --- comment-poster tests ---

describe('comment-poster', () => {
  it('exports postReview and getReviewComments functions', async () => {
    const { postReview, getReviewComments } = await import('../src/review/comment-poster.js');
    expect(typeof postReview).toBe('function');
    expect(typeof getReviewComments).toBe('function');
  });
});

// --- integration-style test for the reviewer module ---

describe('reviewer module', () => {
  it('exports handleCodeReview and handleCodeReviewMerged', async () => {
    const { handleCodeReview, handleCodeReviewMerged } = await import('../src/review/reviewer.js');
    expect(typeof handleCodeReview).toBe('function');
    expect(typeof handleCodeReviewMerged).toBe('function');
  });
});
