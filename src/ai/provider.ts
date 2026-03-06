export interface AIProvider {
  complete(prompt: string): Promise<string>;
}
