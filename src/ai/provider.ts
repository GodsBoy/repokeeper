export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResponse {
  text: string;
  usage: AIUsage;
}

export interface AIRequestOptions {
  maxTokens?: number;
}

export interface AIProvider {
  complete(prompt: string, options?: AIRequestOptions): Promise<AIResponse>;
}
