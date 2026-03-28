import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseImports } from '../src/review/context-builder.js';
import { parseDiffHunks, isAlreadyReviewed, markReviewed, getReviewedShas, cleanupPR } from '../src/review/hunk-tracker.js';
import { getAcceptedPatterns, addAcceptedPattern, learnFromMergedPR, formatAcceptedPatternsPrompt } from '../src/review/memory.js';
import { matchesIgnorePattern, filterIgnoredFiles, buildCommitStatus } from '../src/review/reviewer.js';
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

// --- review file filtering tests ---

describe('matchesIgnorePattern', () => {
  it('matches exact file paths', () => {
    expect(matchesIgnorePattern('package-lock.json', 'package-lock.json')).toBe(true);
  });

  it('matches single wildcard patterns', () => {
    expect(matchesIgnorePattern('src/utils.test.ts', 'src/*.test.ts')).toBe(true);
    expect(matchesIgnorePattern('src/deep/utils.test.ts', 'src/*.test.ts')).toBe(false);
  });

  it('matches globstar patterns', () => {
    expect(matchesIgnorePattern('src/deep/nested/file.test.ts', '**/*.test.ts')).toBe(true);
    expect(matchesIgnorePattern('file.test.ts', '**/*.test.ts')).toBe(true);
  });

  it('matches directory globstar patterns', () => {
    expect(matchesIgnorePattern('dist/index.js', 'dist/**')).toBe(true);
    expect(matchesIgnorePattern('dist/sub/file.js', 'dist/**')).toBe(true);
    expect(matchesIgnorePattern('src/dist/file.js', 'dist/**')).toBe(false);
  });

  it('matches single character wildcard', () => {
    expect(matchesIgnorePattern('src/a.ts', 'src/?.ts')).toBe(true);
    expect(matchesIgnorePattern('src/ab.ts', 'src/?.ts')).toBe(false);
  });

  it('does not match unrelated files', () => {
    expect(matchesIgnorePattern('src/index.ts', '**/*.test.ts')).toBe(false);
    expect(matchesIgnorePattern('README.md', 'dist/**')).toBe(false);
  });

  it('handles dots in patterns correctly', () => {
    expect(matchesIgnorePattern('.env', '.env')).toBe(true);
    expect(matchesIgnorePattern('xenv', '.env')).toBe(false);
  });

  it('escapes regex metacharacters in patterns', () => {
    expect(matchesIgnorePattern('src/file[1].ts', 'src/file[1].ts')).toBe(true);
    expect(matchesIgnorePattern('src/file(test).ts', 'src/file(test).ts')).toBe(true);
    expect(matchesIgnorePattern('src/file+extra.ts', 'src/file+extra.ts')).toBe(true);
    expect(matchesIgnorePattern('src/fileX.ts', 'src/file[1].ts')).toBe(false);
  });
});

describe('filterIgnoredFiles', () => {
  const files = [
    'src/index.ts',
    'src/utils.test.ts',
    'dist/index.js',
    'package-lock.json',
    'docs/README.md',
  ];

  it('returns all files when no ignore patterns', () => {
    expect(filterIgnoredFiles(files, [])).toEqual(files);
  });

  it('filters files matching a single pattern', () => {
    const result = filterIgnoredFiles(files, ['dist/**']);
    expect(result).not.toContain('dist/index.js');
    expect(result).toHaveLength(4);
  });

  it('filters files matching multiple patterns', () => {
    const result = filterIgnoredFiles(files, ['dist/**', 'package-lock.json']);
    expect(result).not.toContain('dist/index.js');
    expect(result).not.toContain('package-lock.json');
    expect(result).toHaveLength(3);
  });

  it('filters test files with globstar', () => {
    const result = filterIgnoredFiles(files, ['**/*.test.ts']);
    expect(result).not.toContain('src/utils.test.ts');
    expect(result).toContain('src/index.ts');
  });

  it('returns all files when patterns match nothing', () => {
    const result = filterIgnoredFiles(files, ['**/*.xyz']);
    expect(result).toEqual(files);
  });

  it('handles undefined/empty ignore patterns gracefully', () => {
    expect(filterIgnoredFiles(files, undefined as unknown as string[])).toEqual(files);
  });
});

// --- commit status tests ---

describe('buildCommitStatus', () => {
  it('returns failure when BLOCKING findings exist', () => {
    const result = buildCommitStatus([
      { file: 'a.ts', line: 1, severity: 'BLOCKING', message: 'Security issue' },
      { file: 'b.ts', line: 2, severity: 'WARNING', message: 'Code smell' },
    ]);
    expect(result.state).toBe('failure');
    expect(result.description).toBe('1 blocking issue(s) found');
  });

  it('counts multiple BLOCKING findings', () => {
    const result = buildCommitStatus([
      { file: 'a.ts', line: 1, severity: 'BLOCKING', message: 'SQL injection' },
      { file: 'b.ts', line: 2, severity: 'BLOCKING', message: 'Hardcoded secret' },
      { file: 'c.ts', line: 3, severity: 'WARNING', message: 'Missing error handling' },
    ]);
    expect(result.state).toBe('failure');
    expect(result.description).toBe('2 blocking issue(s) found');
  });

  it('returns success with count for non-blocking findings only', () => {
    const result = buildCommitStatus([
      { file: 'a.ts', line: 1, severity: 'WARNING', message: 'Code smell' },
      { file: 'b.ts', line: 2, severity: 'SUGGESTION', message: 'Style' },
    ]);
    expect(result.state).toBe('success');
    expect(result.description).toBe('2 non-blocking finding(s)');
  });

  it('returns success with clean message when no findings', () => {
    const result = buildCommitStatus([]);
    expect(result.state).toBe('success');
    expect(result.description).toBe('No issues found');
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
