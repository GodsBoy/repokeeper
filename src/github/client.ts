import { Octokit } from '@octokit/rest';
import type { RepoKeeperConfig } from '../config.js';
import { log } from '../logger.js';

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: RepoKeeperConfig['github']) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
  }

  async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    await this.ensureLabelsExist(labels);
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels,
    });
    log('info', `Added labels [${labels.join(', ')}] to #${issueNumber}`);
  }

  async addComment(issueNumber: number, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    });
    log('info', `Posted comment on #${issueNumber}`);
  }

  async closeIssue(issueNumber: number): Promise<void> {
    await this.octokit.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      state: 'closed',
    });
    log('info', `Closed issue #${issueNumber}`);
  }

  async listOpenIssues(): Promise<
    Array<{ number: number; title: string; body: string | null }>
  > {
    const issues = await this.octokit.paginate(this.octokit.issues.listForRepo, {
      owner: this.owner,
      repo: this.repo,
      state: 'open',
      per_page: 100,
    });
    return issues
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        body: i.body ?? null,
      }));
  }

  async getPRDiff(pullNumber: number): Promise<string> {
    const { data } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: pullNumber,
      mediaType: { format: 'diff' },
    });
    return data as unknown as string;
  }

  async getPRFiles(
    pullNumber: number,
  ): Promise<Array<{ filename: string; additions: number; deletions: number; status: string }>> {
    const files = await this.octokit.paginate(this.octokit.pulls.listFiles, {
      owner: this.owner,
      repo: this.repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return files.map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status,
    }));
  }

  private async ensureLabelsExist(labels: string[]): Promise<void> {
    const existing = await this.octokit.paginate(this.octokit.issues.listLabelsForRepo, {
      owner: this.owner,
      repo: this.repo,
      per_page: 100,
    });
    const existingNames = new Set(existing.map((l) => l.name));

    const labelColors: Record<string, string> = {
      bug: 'd73a4a',
      enhancement: 'a2eeef',
      question: 'd876e3',
      duplicate: 'cfd3d7',
      documentation: '0075ca',
      invalid: 'e4e669',
      'needs-info': 'fbca04',
      'size/small': 'c2e0c6',
      'size/medium': 'fef2c0',
      'size/large': 'f9d0c4',
    };

    for (const label of labels) {
      if (!existingNames.has(label)) {
        await this.octokit.issues.createLabel({
          owner: this.owner,
          repo: this.repo,
          name: label,
          color: labelColors[label] ?? '808080',
        });
        log('info', `Created label: ${label}`);
      }
    }
  }
}
