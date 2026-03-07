export type ReviewSeverity = 'BLOCKING' | 'WARNING' | 'SUGGESTION';

export interface ReviewFinding {
  file: string;
  line: number;
  severity: ReviewSeverity;
  message: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
}

export interface EnrichedFile {
  changedFile: string;
  fileContent: string;
  dependencies: Array<{ path: string; content: string }>;
}

export interface HunkInfo {
  file: string;
  startLine: number;
  lineCount: number;
  content: string;
}

export interface ReviewMemoryEntry {
  pattern: string;
  acceptedAt: string;
  prNumber: number;
}

export interface CodeReviewConfig {
  enabled: boolean;
  focus: string[];
  maxContextFiles: number;
  minDiffLines: number;
}

export interface PRReviewPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    merged?: boolean;
    base: {
      sha: string;
      ref: string;
      repo: {
        full_name: string;
        clone_url: string;
      };
    };
    head: {
      sha: string;
    };
  };
  repository: {
    full_name: string;
    clone_url: string;
    owner: {
      login: string;
    };
    name: string;
  };
}
