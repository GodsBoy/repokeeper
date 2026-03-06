import type { AIProvider } from './provider.js';

export class OllamaProvider implements AIProvider {
  private url: string;
  private model: string;

  constructor(model: string) {
    this.url = process.env.OLLAMA_URL ?? 'http://localhost:11434';
    this.model = model;
  }

  async complete(prompt: string): Promise<string> {
    const response = await fetch(`${this.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { response: string };
    return data.response;
  }
}
