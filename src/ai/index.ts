import type { RepoKeeperConfig } from '../config.js';
import type { AIProvider } from './provider.js';
import { ClaudeProvider } from './claude.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';

export type { AIProvider } from './provider.js';

export function createAIProvider(config: RepoKeeperConfig['ai']): AIProvider {
  switch (config.provider) {
    case 'claude':
      return new ClaudeProvider(config.model);
    case 'openai':
      return new OpenAIProvider(config.model);
    case 'ollama':
      return new OllamaProvider(config.model);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}
