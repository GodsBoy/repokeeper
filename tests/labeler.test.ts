import { describe, it, expect } from 'vitest';
import { getPRSizeLabel } from '../src/pr/labeler.js';

describe('getPRSizeLabel', () => {
  it('labels small PRs under 100 lines', () => {
    expect(getPRSizeLabel(0)).toBe('size/small');
    expect(getPRSizeLabel(50)).toBe('size/small');
    expect(getPRSizeLabel(99)).toBe('size/small');
  });

  it('labels medium PRs between 100-500 lines', () => {
    expect(getPRSizeLabel(100)).toBe('size/medium');
    expect(getPRSizeLabel(300)).toBe('size/medium');
    expect(getPRSizeLabel(500)).toBe('size/medium');
  });

  it('labels large PRs over 500 lines', () => {
    expect(getPRSizeLabel(501)).toBe('size/large');
    expect(getPRSizeLabel(1000)).toBe('size/large');
    expect(getPRSizeLabel(10000)).toBe('size/large');
  });
});
