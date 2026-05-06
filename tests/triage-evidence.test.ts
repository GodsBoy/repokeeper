import { describe, expect, it } from 'vitest';
import {
  buildClassificationEvidence,
  buildDuplicateEvidence,
  renderEvidenceCard,
} from '../src/triage/evidence.js';

describe('renderEvidenceCard', () => {
  it('renders a compact classification evidence card', () => {
    const evidence = buildClassificationEvidence(
      'bug',
      'bug',
      'Login crashes',
      'The login page throws a TypeError with a stack trace.',
    );

    const result = renderEvidenceCard(evidence);

    expect(result).toContain('RepoKeeper triage evidence');
    expect(result).toContain('Classification: bug');
    expect(result).toContain('Label: `bug`');
    expect(result).toContain('Confidence: medium');
    expect(result).toContain('technical detail');
  });

  it('renders duplicate candidates in score order', () => {
    const evidence = buildDuplicateEvidence([
      { number: 12, title: 'Install fails on Windows', score: 0.91 },
      { number: 8, title: 'Setup does not finish', score: 0.82 },
    ]);

    const result = renderEvidenceCard(evidence);

    expect(result).toContain('Classification: possible duplicate');
    expect(result).toContain('#12 "Install fails on Windows" (91% match)');
    expect(result).toContain('#8 "Setup does not finish" (82% match)');
    expect(result.indexOf('#12')).toBeLessThan(result.indexOf('#8'));
  });

  it('limits duplicate candidates to three by default', () => {
    const evidence = buildDuplicateEvidence([
      { number: 1, title: 'First', score: 0.95 },
      { number: 2, title: 'Second', score: 0.9 },
      { number: 3, title: 'Third', score: 0.85 },
      { number: 4, title: 'Fourth', score: 0.8 },
    ]);

    const result = renderEvidenceCard(evidence);

    expect(result).toContain('#1 "First"');
    expect(result).toContain('#3 "Third"');
    expect(result).not.toContain('#4 "Fourth"');
  });

  it('uses low confidence for needs-more-info issues', () => {
    const evidence = buildClassificationEvidence('needs-more-info', 'needs-more-info', 'Broken', 'it fails');

    const result = renderEvidenceCard(evidence);

    expect(result).toContain('Confidence: low');
    expect(result).toContain('does not include enough detail');
  });
});
