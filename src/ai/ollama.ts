import type { AIProvider, AIResponse, AIRequestOptions } from './provider.js';

interface OllamaResponse {
  response: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements AIProvider {
  private url: string;
  private model: string;

  constructor(model: string) {
    this.url = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    this.model = model;
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
    const response = await fetch(`${this.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        ...(options?.maxTokens ? { options: { num_predict: options.maxTokens } } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaResponse;
    return {
      text: data.response,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
    };
  }
}
