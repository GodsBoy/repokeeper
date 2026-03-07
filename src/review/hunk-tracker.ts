import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { log } from '../logger.js';
import type { HunkInfo } from './types.js';

const TRACKED_SHAS_PATH = '/tmp/repokeeper-cache/reviewed-shas.json';

interface TrackedShas {
  [prKey: string]: string[];
}

function loadTrackedShas(): TrackedShas {
  if (!existsSync(TRACKED_SHAS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(TRACKED_SHAS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveTrackedShas(data: TrackedShas): void {
  const dir = dirname(TRACKED_SHAS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(TRACKED_SHAS_PATH, JSON.stringify(data, null, 2));
}

function prKey(owner: string, repo: string, prNumber: number): string {
  return `${owner}/${repo}#${prNumber}`;
}

export function isAlreadyReviewed(owner: string, repo: string, prNumber: number, sha: string): boolean {
  const data = loadTrackedShas();
  const key = prKey(owner, repo, prNumber);
  return data[key]?.includes(sha) ?? false;
}

export function markReviewed(owner: string, repo: string, prNumber: number, sha: string): void {
  const data = loadTrackedShas();
  const key = prKey(owner, repo, prNumber);
  if (!data[key]) data[key] = [];
  if (!data[key].includes(sha)) {
    data[key].push(sha);
  }
  saveTrackedShas(data);
  log('info', `Marked ${key} SHA ${sha.slice(0, 7)} as reviewed`);
}

export function getReviewedShas(owner: string, repo: string, prNumber: number): string[] {
  const data = loadTrackedShas();
  const key = prKey(owner, repo, prNumber);
  return data[key] ?? [];
}

export function parseDiffHunks(diff: string): HunkInfo[] {
  const hunks: HunkInfo[] = [];
  const lines = diff.split('\n');
  let currentFile = '';
  let currentHunkStart = 0;
  let currentHunkLines: string[] = [];
  let lineCounter = 0;

  for (const line of lines) {
    // Match diff file header: diff --git a/path b/path
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (fileMatch) {
      // Save previous hunk if exists
      if (currentFile && currentHunkLines.length > 0) {
        hunks.push({
          file: currentFile,
          startLine: currentHunkStart,
          lineCount: currentHunkLines.length,
          content: currentHunkLines.join('\n'),
        });
      }
      currentFile = fileMatch[2];
      currentHunkLines = [];
      currentHunkStart = 0;
      lineCounter = 0;
      continue;
    }

    // Match hunk header: @@ -old,count +new,count @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      // Save previous hunk in same file
      if (currentFile && currentHunkLines.length > 0) {
        hunks.push({
          file: currentFile,
          startLine: currentHunkStart,
          lineCount: currentHunkLines.length,
          content: currentHunkLines.join('\n'),
        });
      }
      currentHunkStart = parseInt(hunkMatch[1], 10);
      currentHunkLines = [];
      lineCounter = 0;
      continue;
    }

    // Track added/modified lines (+ prefix)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunkLines.push(line);
      lineCounter++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // Removed lines don't increment line counter
    } else if (!line.startsWith('\\')) {
      lineCounter++;
    }
  }

  // Save last hunk
  if (currentFile && currentHunkLines.length > 0) {
    hunks.push({
      file: currentFile,
      startLine: currentHunkStart,
      lineCount: currentHunkLines.length,
      content: currentHunkLines.join('\n'),
    });
  }

  return hunks;
}

export function cleanupPR(owner: string, repo: string, prNumber: number): void {
  const data = loadTrackedShas();
  const key = prKey(owner, repo, prNumber);
  delete data[key];
  saveTrackedShas(data);
}
