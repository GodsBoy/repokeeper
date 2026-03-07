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

const COMMENT_PROMPT = `You are a helpful open source project maintainer bot. Write a brief, friendly comment for a GitHub issue.

Issue title: {title}
Issue body: {body}
Classification: {category}

Rules:
- Be concise (2-4 sentences max)
- Reference what the issue is actually about — mention the specific topic from the title/body
- Do NOT say "Thanks for the detailed bug report" if the issue has little detail
- Do NOT be generic — your comment should make sense ONLY for this specific issue
- Match the tone to the category:
  - bug: Acknowledge the problem described, mention you'll investigate
  - feature: Acknowledge the specific feature idea, mention it's been tagged for review
  - question: Acknowledge the specific question, point to docs if relevant
  - docs: Acknowledge the documentation issue, welcome PRs
  - invalid: Politely explain the issue isn't actionable in current form
- End with one short actionable sentence (e.g., "A maintainer will follow up shortly.")
- Do NOT use markdown headers or bullet lists — just plain text paragraphs

Write ONLY the comment text. Nothing else.`;

const NEEDS_INFO_PROMPT = `You are a helpful open source project maintainer bot. A new issue was opened but it lacks enough detail to act on.

Issue title: {title}
Issue body: {body}

Write a brief, friendly comment asking for more information. Rules:
- Acknowledge what the issue seems to be about based on the title
- Ask for specific details that would help investigate:
  - What OS and Node.js version they're using
  - The exact error message or unexpected behaviour
  - Steps to reproduce the problem
  - What they expected to happen vs what actually happened
- Keep it to 3-5 sentences plus a short bullet list of needed info
- Be warm but specific — don't be generic
- Do NOT say "Thanks for the detailed report" — the report is NOT detailed

Write ONLY the comment text. Nothing else.`;

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
    await github.addLabels(number, ['possible-duplicate']);
    await github.addComment(
      number,
      `This issue appears to be related to #${dup.number} ("${dup.title}"), which covers a similar topic. ` +
        `Please check that issue first — if your problem is different, feel free to reopen this with ` +
        `additional details explaining how it differs.\n\nThank you for contributing!`,
    );
    log('info', `Issue #${number} flagged as possible duplicate of #${dup.number}`);
    return;
  }

  // Classify the issue
  const category = await classifyIssue(title, bodyText, ai);
  const label = categoryToLabel(category);
  const labels = [label];

  await github.addLabels(number, labels);

  // Generate contextual response using AI
  const comment = await generateComment(title, bodyText, category, ai);
  await github.addComment(number, comment);

  log('info', `Issue #${number} classified as "${category}", labelled [${labels.join(', ')}]`);
}

async function generateComment(
  title: string,
  body: string,
  category: string,
  ai: AIProvider,
): Promise<string> {
  const promptTemplate = category === 'needs-more-info' ? NEEDS_INFO_PROMPT : COMMENT_PROMPT;

  const prompt = promptTemplate
    .replace('{title}', title)
    .replace('{body}', body || '(no body provided)')
    .replace('{category}', category);

  try {
    const response = (await ai.complete(prompt)).trim();
    // Sanity check: if AI returns something too short or suspicious, use fallback
    if (response.length < 20) {
      return buildFallbackComment(category, title);
    }
    return response;
  } catch (err) {
    log('warn', 'AI comment generation failed, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallbackComment(category, title);
  }
}

function buildFallbackComment(category: string, title: string): string {
  switch (category) {
    case 'needs-more-info':
      return (
        `Thanks for opening this issue about "${title}". We'd like to help, but we need a bit more information to investigate. ` +
        `Could you please share:\n\n` +
        `- Your OS and Node.js version\n` +
        `- The exact error message (if any)\n` +
        `- Steps to reproduce the problem\n` +
        `- What you expected to happen vs what actually happened\n\n` +
        `This will help us track down the issue much faster.`
      );

    case 'bug':
      return (
        `Thanks for reporting this issue with "${title}". We'll investigate and follow up. ` +
        `If you have any additional details like a minimal reproduction, feel free to add them here.`
      );

    case 'feature':
      return (
        `Thanks for suggesting this — "${title}" has been tagged for review. ` +
        `The maintainers will discuss feasibility. Feel free to add any additional context or use cases.`
      );

    case 'question':
      return (
        `Thanks for your question about "${title}". ` +
        `A maintainer will follow up soon. In the meantime, check our README for related documentation.`
      );

    case 'docs':
      return (
        `Thanks for flagging this documentation issue. We've tagged it accordingly. ` +
        `PRs to improve our docs are always welcome!`
      );

    case 'invalid':
      return (
        `Thanks for reaching out. This issue doesn't appear to be actionable in its current form. ` +
        `If you believe this was classified incorrectly, please provide more context.`
      );

    default:
      return `Thanks for opening this issue about "${title}". A maintainer will review it soon.`;
  }
}
