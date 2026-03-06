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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
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
