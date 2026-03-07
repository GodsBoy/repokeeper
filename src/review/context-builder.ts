import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { log } from '../logger.js';
import type { EnrichedFile } from './types.js';

const CACHE_DIR = '/tmp/repokeeper-cache';

export function getCacheDir(owner: string, repo: string): string {
  return join(CACHE_DIR, `${owner}-${repo}`);
}

export function ensureRepo(cloneUrl: string, owner: string, repo: string, baseSha: string): string {
  const repoDir = getCacheDir(owner, repo);

  if (!existsSync(repoDir)) {
    mkdirSync(repoDir, { recursive: true });
    log('info', `Cloning ${owner}/${repo} into cache`);
    execSync(`git clone --bare "${cloneUrl}" "${repoDir}"`, {
      stdio: 'pipe',
      timeout: 120_000,
    });
  } else {
    log('info', `Fetching latest for ${owner}/${repo}`);
    execSync('git fetch --all', {
      cwd: repoDir,
      stdio: 'pipe',
      timeout: 60_000,
    });
  }

  return repoDir;
}

export function readFileAtCommit(repoDir: string, filePath: string, sha: string): string | null {
  try {
    const content = execSync(`git show "${sha}:${filePath}"`, {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
    });
    return content;
  } catch {
    return null;
  }
}

export function parseImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const ext = filePath.split('.').pop() ?? '';
  const tsJsExts = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'];

  if (!tsJsExts.includes(ext)) return imports;

  // Match ES import statements: import ... from '...'
  const esImportRe = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  // Match require() calls
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const re of [esImportRe, requireRe]) {
    let match;
    while ((match = re.exec(content)) !== null) {
      const specifier = match[1];
      // Only resolve relative imports (skip packages)
      if (specifier.startsWith('.')) {
        const resolved = resolveImportPath(specifier, filePath);
        if (resolved) imports.push(resolved);
      }
    }
  }

  return imports;
}

function resolveImportPath(specifier: string, fromFile: string): string | null {
  const dir = dirname(fromFile);
  const base = join(dir, specifier).replace(/\\/g, '/');

  // Common extensions to try
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '/index.ts', '/index.js'];

  // If it already has an extension
  if (/\.\w+$/.test(specifier)) {
    // Convert .js to .ts for TS projects
    if (specifier.endsWith('.js')) {
      return base.replace(/\.js$/, '.ts');
    }
    return base;
  }

  // Return with .ts as default guess for TS projects
  return base + '.ts';
}

export async function buildContext(
  changedFiles: string[],
  cloneUrl: string,
  owner: string,
  repo: string,
  baseSha: string,
  maxContextFiles: number,
): Promise<EnrichedFile[]> {
  const repoDir = ensureRepo(cloneUrl, owner, repo, baseSha);
  const enriched: EnrichedFile[] = [];

  for (const file of changedFiles) {
    const fileContent = readFileAtCommit(repoDir, file, baseSha);
    if (!fileContent) continue;

    const importPaths = parseImports(fileContent, file);
    const dependencies: Array<{ path: string; content: string }> = [];

    for (const imp of importPaths.slice(0, maxContextFiles)) {
      const depContent = readFileAtCommit(repoDir, imp, baseSha);
      if (depContent) {
        dependencies.push({ path: imp, content: depContent });
      }
    }

    enriched.push({ changedFile: file, fileContent, dependencies });
  }

  return enriched;
}
