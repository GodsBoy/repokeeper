export default {
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    owner: 'your-org',
    repo: 'your-repo',
  },
  ai: {
    provider: 'claude' as const,
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
