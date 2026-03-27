import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIResponse, AIRequestOptions } from './provider.js';

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Claude provider');
    }
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    return {
      text: block.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
