import { describe, it, expect } from 'vitest';
import { withAttribution } from '../src/utils/attribution.js';

describe('withAttribution', () => {
  it('appends attribution footer when enabled', () => {
    const result = withAttribution('Hello world', { enabled: true });
    expect(result).toContain('Hello world');
    expect(result).toContain('Powered by [RepoKeeper]');
    expect(result).toContain('AI-powered repo maintenance');
  });

  it('returns body unchanged when disabled', () => {
    const result = withAttribution('Hello world', { enabled: false });
    expect(result).toBe('Hello world');
  });

  it('includes playground link when playgroundUrl is set', () => {
    const result = withAttribution('Body', {
      enabled: true,
      playgroundUrl: 'https://example.com/playground',
    });
    expect(result).toContain('[Try it live](https://example.com/playground)');
  });

  it('omits playground link when playgroundUrl is undefined', () => {
    const result = withAttribution('Body', { enabled: true });
    expect(result).not.toContain('Try it live');
  });

  it('separates footer with horizontal rule', () => {
    const result = withAttribution('Body', { enabled: true });
    expect(result).toContain('\n\n---\n');
  });
});
