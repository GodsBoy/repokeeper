import { describe, it, expect } from 'vitest';
import { classifyIssue, categoryToLabel } from '../src/triage/classifier.js';
import type { AIProvider } from '../src/ai/provider.js';

function mockAI(response: string): AIProvider {
  return { complete: async () => response };
}

describe('classifyIssue', () => {
  it('returns the category when AI responds cleanly', async () => {
    const result = await classifyIssue('App crashes on login', 'Crash stack trace...', mockAI('bug'));
    expect(result).toBe('bug');
  });

  it('handles AI response with whitespace', async () => {
    const result = await classifyIssue('Add dark mode', 'Would be nice', mockAI('  feature  '));
    expect(result).toBe('feature');
  });

  it('extracts category from verbose AI response', async () => {
    const result = await classifyIssue('How to install?', 'Help me', mockAI('This is a question from a user'));
    expect(result).toBe('question');
  });

  it('falls back to question for unrecognised response', async () => {
    const result = await classifyIssue('Random', 'stuff', mockAI('I am not sure what this is'));
    expect(result).toBe('question');
  });
});

describe('categoryToLabel', () => {
  it('maps bug to bug', () => expect(categoryToLabel('bug')).toBe('bug'));
  it('maps feature to enhancement', () => expect(categoryToLabel('feature')).toBe('enhancement'));
  it('maps question to question', () => expect(categoryToLabel('question')).toBe('question'));
  it('maps duplicate to duplicate', () => expect(categoryToLabel('duplicate')).toBe('duplicate'));
  it('maps docs to documentation', () => expect(categoryToLabel('docs')).toBe('documentation'));
  it('maps invalid to invalid', () => expect(categoryToLabel('invalid')).toBe('invalid'));
});
