import { describe, it, expect } from 'vitest';
import { findDuplicates } from '../src/triage/duplicate.js';

const existingIssues = [
  { number: 1, title: 'App crashes when clicking login button', body: 'The app crashes on the login screen' },
  { number: 2, title: 'Add dark mode support', body: 'Please add dark mode theme to the UI' },
  { number: 3, title: 'Documentation typo in README', body: 'There is a typo in the installation section' },
];

describe('findDuplicates', () => {
  it('finds a duplicate with high similarity', () => {
    const results = findDuplicates(
      'App crashes on login button click',
      'The app crashes when I click login',
      existingIssues,
      0.5,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].number).toBe(1);
  });

  it('returns empty when no duplicates above threshold', () => {
    const results = findDuplicates(
      'Completely unrelated issue about database migrations',
      'The database migration tool fails',
      existingIssues,
      0.85,
    );
    expect(results).toHaveLength(0);
  });

  it('sorts results by score descending', () => {
    const results = findDuplicates(
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
    const results = findDuplicates('Some issue', 'Some body', [], 0.5);
    expect(results).toHaveLength(0);
  });

  it('handles empty body', () => {
    const results = findDuplicates('Add dark mode', '', existingIssues, 0.3);
    expect(results.length).toBeGreaterThanOrEqual(0); // should not throw
  });
});
