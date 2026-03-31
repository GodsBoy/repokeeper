export interface AttributionConfig {
  enabled: boolean;
  playgroundUrl?: string;
}

export function withAttribution(body: string, config: AttributionConfig): string {
  if (!config.enabled) return body;
  const playgroundLink = config.playgroundUrl
    ? ` · [Try it live](${config.playgroundUrl})`
    : '';
  return `${body}\n\n---\n*Powered by [RepoKeeper](https://github.com/GodsBoy/repokeeper) — AI-powered repo maintenance${playgroundLink}*`;
}
