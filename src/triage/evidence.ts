import type { IssueCategory } from './classifier.js';
import type { SimilarIssue } from './duplicate.js';

const DEFAULT_DUPLICATE_LIMIT = 3;

export interface TriageEvidence {
  classification: IssueCategory | 'possible-duplicate';
  label: string;
  reason?: string;
  confidence: 'high' | 'medium' | 'low';
  duplicateCandidates?: SimilarIssue[];
}

export function buildClassificationEvidence(
  classification: IssueCategory,
  label: string,
  title: string,
  body: string,
): TriageEvidence {
  return {
    classification,
    label,
    reason: classificationReason(classification, title, body),
    confidence: classification === 'needs-more-info' ? 'low' : 'medium',
  };
}

export function buildDuplicateEvidence(
  candidates: SimilarIssue[],
  limit: number = DEFAULT_DUPLICATE_LIMIT,
): TriageEvidence {
  const duplicateCandidates = candidates.slice(0, limit);
  const highestScore = duplicateCandidates[0]?.score ?? 0;

  return {
    classification: 'possible-duplicate',
    label: 'possible-duplicate',
    reason: duplicateCandidates.length > 1
      ? 'Multiple related issues were found. Please compare them before treating this as a duplicate.'
      : 'A related issue was found. Please compare it before treating this as a duplicate.',
    confidence: highestScore >= 0.9 ? 'high' : 'medium',
    duplicateCandidates,
  };
}

export function renderEvidenceCard(evidence: TriageEvidence): string {
  const lines = [
    'RepoKeeper triage evidence',
    `- Classification: ${formatClassification(evidence.classification)}`,
    `- Label: \`${evidence.label}\``,
    `- Confidence: ${evidence.confidence}`,
  ];

  if (evidence.reason) {
    lines.push(`- Evidence: ${evidence.reason}`);
  }

  if (evidence.duplicateCandidates && evidence.duplicateCandidates.length > 0) {
    lines.push('- Possible related issues:');
    for (const candidate of evidence.duplicateCandidates) {
      lines.push(`  - #${candidate.number} "${candidate.title}" (${formatScore(candidate.score)} match)`);
    }
  }

  return lines.join('\n');
}

function classificationReason(classification: IssueCategory, title: string, body: string): string {
  const subject = title.trim() ? `"${title.trim()}"` : 'this issue';
  const hasTechnicalDetail = /```|`[^`]+`|error|exception|stack|traceback|step|reproduc|expected|actual/i.test(body);

  switch (classification) {
    case 'bug':
      return hasTechnicalDetail
        ? `${subject} describes broken behavior with technical detail.`
        : `${subject} describes behavior that is not working as expected.`;
    case 'feature':
      return `${subject} asks for new or improved functionality.`;
    case 'question':
      return `${subject} is asking for help or clarification.`;
    case 'docs':
      return `${subject} is about documentation or setup guidance.`;
    case 'invalid':
      return `${subject} does not look actionable in its current form.`;
    case 'needs-more-info':
      return `${subject} does not include enough detail to investigate confidently.`;
    case 'duplicate':
      return `${subject} appears to overlap with an existing issue.`;
  }
}

function formatClassification(classification: TriageEvidence['classification']): string {
  return classification.replace(/-/g, ' ');
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}
