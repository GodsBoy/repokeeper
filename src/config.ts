import yaml from 'js-yaml';
import { Octokit } from '@octokit/rest';
import { log } from './logger.js';

export interface RepoKeeperConfig {
  github: {
    token: string;
    webhookSecret: string;
    owner: string;
    repo: string;
  };
  ai: {
    provider: 'claude' | 'openai' | 'ollama';
    model: string;
  };
  triage: {
    enabled: boolean;
    duplicateThreshold: number;
    minimumBodyLength: number;
  };
  prSummariser: {
    enabled: boolean;
    minDiffLines: number;
    generateReleaseNotes: boolean;
  };
  codeReview: {
    enabled: boolean;
    focus: string[];
    maxContextFiles: number;
    minDiffLines: number;
  };
  port: number;
}

const defaults: RepoKeeperConfig = {
  github: {
    token: process.env.GITHUB_TOKEN ?? '',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
    owner: '',
    repo: '',
  },
  ai: {
    provider: 'claude',
    model: 'claude-sonnet-4-6',
  },
  triage: {
    enabled: true,
    duplicateThreshold: 0.85,
    minimumBodyLength: 100,
  },
  prSummariser: {
    enabled: true,
    minDiffLines: 50,
    generateReleaseNotes: true,
  },
  codeReview: {
    enabled: true,
    focus: ['security', 'performance', 'test-coverage', 'breaking-changes'],
    maxContextFiles: 5,
    minDiffLines: 10,
  },
  port: 3001,
};

let config: RepoKeeperConfig = defaults;

export async function loadConfig(): Promise<RepoKeeperConfig> {
  try {
    const userConfig = await import(process.cwd() + '/repokeeper.config.ts');
    const raw = userConfig.default ?? userConfig;
    config = deepMerge(defaults, raw);
  } catch {
    console.warn('[config] No repokeeper.config.ts found, using defaults + env vars');
  }

  validate(config);

  // Try to load per-repo YAML config (repo YAML overrides local config for repo-specific keys)
  const repoYaml = await fetchRepoConfig(config.github);
  if (repoYaml) {
    config = mergeRepoConfig(config, repoYaml);
    log('info', 'Loaded per-repo config from .github/repokeeper.yml');
  }

  return config;
}

export function getConfig(): RepoKeeperConfig {
  return config;
}

function validate(cfg: RepoKeeperConfig): void {
  if (!cfg.github.token) {
    throw new Error('GITHUB_TOKEN is required (set via env or config)');
  }
  if (!cfg.github.webhookSecret) {
    throw new Error('GITHUB_WEBHOOK_SECRET is required (set via env or config)');
  }
  if (!cfg.github.owner || !cfg.github.repo) {
    throw new Error('github.owner and github.repo are required in config');
  }
}

export async function fetchRepoConfig(
  github: RepoKeeperConfig['github'],
): Promise<Record<string, unknown> | null> {
  try {
    const octokit = new Octokit({ auth: github.token });
    const { data } = await octokit.repos.getContent({
      owner: github.owner,
      repo: github.repo,
      path: '.github/repokeeper.yml',
    });

    if ('content' in data && typeof data.content === 'string') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const parsed = yaml.load(content);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    }
  } catch {
    // File doesn't exist or can't be fetched — not an error
  }

  return null;
}

// Repo-specific keys that the YAML config is allowed to override
const REPO_OVERRIDE_KEYS = ['triage', 'prSummariser', 'ai', 'codeReview'] as const;

export function mergeRepoConfig(
  base: RepoKeeperConfig,
  repoYaml: Record<string, unknown>,
): RepoKeeperConfig {
  let merged = { ...base };

  for (const key of REPO_OVERRIDE_KEYS) {
    if (key in repoYaml && repoYaml[key] && typeof repoYaml[key] === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merged = { ...merged, [key]: deepMerge((merged as any)[key], repoYaml[key]) };
    }
  }

  return merged;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(target[key] ?? {}, val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}
