import { describe, it, expect } from 'vitest';
import { findDuplicates, findDuplicatesJaccard } from '../src/triage/duplicate.js';
import type { AIProvider } from '../src/ai/provider.js';

const existingIssues = [
  { number: 1, title: 'App crashes when clicking login button', body: 'The app crashes on the login screen' },
  { number: 2, title: 'Add dark mode support', body: 'Please add dark mode theme to the UI' },
  { number: 3, title: 'Documentation typo in README', body: 'There is a typo in the installation section' },
];

function mockAI(response: string): AIProvider {
  return { complete: async () => response };
}

function failingAI(): AIProvider {
  return {
    complete: async () => {
      throw new Error('AI service unavailable');
    },
  };
}

describe('findDuplicatesJaccard', () => {
  it('finds a duplicate with high similarity', () => {
    const results = findDuplicatesJaccard(
      'App crashes on login button click',
      'The app crashes when I click login',
      existingIssues,
      0.5,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].number).toBe(1);
  });

  it('returns empty when no duplicates above threshold', () => {
    const results = findDuplicatesJaccard(
      'Completely unrelated issue about database migrations',
      'The database migration tool fails',
      existingIssues,
      0.85,
    );
    expect(results).toHaveLength(0);
  });

  it('sorts results by score descending', () => {
    const results = findDuplicatesJaccard(
      'App crashes dark mode login',
      'crashes dark mode login button',
      existingIssues,
      0.1,
    );
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('handles empty existing issues', () => {
    const results = findDuplicatesJaccard('Some issue', 'Some body', [], 0.5);
    expect(results).toHaveLength(0);
  });

  it('handles empty body', () => {
    const results = findDuplicatesJaccard('Add dark mode', '', existingIssues, 0.3);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});

describe('findDuplicates with AI', () => {
  it('uses AI to score similarity when provider is given', async () => {
    const ai = mockAI('0.92');
    const results = await findDuplicates(
      'App crashes on login button click',
      'The app crashes when I click login',
      existingIssues,
      0.8,
      ai,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBe(0.92);
  });

  it('falls back to Jaccard when AI fails', async () => {
    const ai = failingAI();
    const results = await findDuplicates(
      'App crashes on login button click',
      'The app crashes when I click login',
      existingIssues,
      0.5,
      ai,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].number).toBe(1);
  });

  it('works without AI provider (Jaccard only)', async () => {
    const results = await findDuplicates(
      'App crashes on login button click',
      'The app crashes when I click login',
      existingIssues,
      0.5,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].number).toBe(1);
  });

  it('filters AI results below threshold', async () => {
    const ai = mockAI('0.3');
    const results = await findDuplicates(
      'App crashes on login button click',
      'The app crashes when I click login',
      existingIssues,
      0.8,
      ai,
    );
    expect(results).toHaveLength(0);
  });

  it('handles AI returning invalid number', async () => {
    const ai = mockAI('not a number');
    const results = await findDuplicates(
      'App crashes on login button click',
      'The app crashes when I click login',
      existingIssues,
      0.8,
      ai,
    );
    expect(results).toHaveLength(0);
  });
});
