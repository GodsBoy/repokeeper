import type { AIProvider } from '../ai/provider.js';
import type { GitHubClient } from '../github/client.js';
import type { RepoKeeperConfig } from '../config.js';
import { classifyIssue, categoryToLabel } from './classifier.js';
import { findDuplicates } from './duplicate.js';
import { log } from '../logger.js';

interface IssuePayload {
  issue: {
    number: number;
    title: string;
    body: string | null;
  };
}

export async function handleIssueOpened(
  payload: IssuePayload,
  ai: AIProvider,
  github: GitHubClient,
  config: RepoKeeperConfig,
): Promise<void> {
  const { number, title, body } = payload.issue;
  const bodyText = body ?? '';

  log('info', `Triaging issue #${number}: ${title}`);

  // Check for duplicates first
  const openIssues = await github.listOpenIssues();
  const existingIssues = openIssues.filter((i) => i.number !== number);
  const duplicates = await findDuplicates(title, bodyText, existingIssues, config.triage.duplicateThreshold, ai);

  if (duplicates.length > 0) {
    const dup = duplicates[0];
    await github.addLabels(number, ['duplicate']);
    await github.addComment(
      number,
      `Thanks for opening this issue! It looks like this may be a duplicate of #${dup.number} ("${dup.title}"). ` +
        `I'm closing this in favour of the existing issue. If you believe this is a separate concern, ` +
        `please reopen with additional context.\n\nThank you for contributing!`,
    );
    await github.closeIssue(number);
    log('info', `Issue #${number} closed as duplicate of #${dup.number}`);
    return;
  }

  // Classify the issue
  const category = await classifyIssue(title, bodyText, ai);
  const label = categoryToLabel(category);
  const labels = [label];

  // Add needs-info if body is too short for bug reports
  if (category === 'bug' && bodyText.length < config.triage.minimumBodyLength) {
    labels.push('needs-info');
  }

  await github.addLabels(number, labels);

  // Generate appropriate response
  const comment = buildComment(category, bodyText, config.triage.minimumBodyLength);
  await github.addComment(number, comment);

  log('info', `Issue #${number} classified as "${category}", labelled [${labels.join(', ')}]`);
}

function buildComment(
  category: string,
  body: string,
  minimumBodyLength: number,
): string {
  switch (category) {
    case 'bug':
      if (body.length < minimumBodyLength) {
        return (
          `Thanks for reporting this bug! To help us investigate, could you please provide:\n\n` +
          `- Steps to reproduce the issue\n` +
          `- Expected behaviour\n` +
          `- Actual behaviour\n` +
          `- Your environment (OS, Node.js version, etc.)\n\n` +
          `The more detail you share, the faster we can help. Thank you!`
        );
      }
      return (
        `Thanks for the detailed bug report! We'll look into this. ` +
        `If you have any additional information or a minimal reproduction, feel free to add it here.`
      );

    case 'feature':
      return (
        `Thanks for the feature suggestion! We've tagged this as an enhancement. ` +
        `The maintainers will review it and discuss feasibility. ` +
        `Feel free to add any additional context or use cases that might help!`
      );

    case 'question':
      return (
        `Thanks for your question! We'll do our best to help. ` +
        `In the meantime, you might find useful information in our README or documentation. ` +
        `A maintainer will follow up soon.`
      );

    case 'docs':
      return (
        `Thanks for flagging this documentation issue! We've tagged it accordingly. ` +
        `Contributions to improve our docs are always welcome — feel free to open a PR!`
      );

    case 'invalid':
      return (
        `Thanks for reaching out. After initial triage, this issue doesn't appear to be actionable ` +
        `in its current form. If you believe this was classified incorrectly, please provide ` +
        `more context and we'll take another look.`
      );

    default:
      return `Thanks for opening this issue! A maintainer will review it soon.`;
  }
}
