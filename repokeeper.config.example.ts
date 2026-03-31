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
    generateReleaseNotes: true,
  },
  // Attribution footer on AI-generated comments (default: enabled)
  attribution: {
    enabled: true,
    // Set to your deployment URL to add a "Try it live" link in the footer
    // playgroundUrl: 'https://your-server.example.com/playground',
  },
  port: 3001,
};
