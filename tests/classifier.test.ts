import { describe, it, expect } from 'vitest';
import { classifyIssue, categoryToLabel, isVagueIssue } from '../src/triage/classifier.js';
import type { AIProvider } from '../src/ai/provider.js';

function mockAI(response: string): AIProvider {
  return { complete: async () => response };
}

describe('isVagueIssue', () => {
  it('flags short body as vague', () => {
    expect(isVagueIssue('its broken')).toBe(true);
    expect(isVagueIssue('')).toBe(true);
    expect(isVagueIssue('app wont start up')).toBe(true);
  });

  it('flags body with < 3 sentences and no technical detail as vague', () => {
    expect(isVagueIssue('The app is not working. It just doesnt work.')).toBe(true);
  });

  it('does NOT flag body with code blocks as vague', () => {
    const body = 'This crashes:\n```\nTypeError: Cannot read property\n```';
    expect(isVagueIssue(body)).toBe(false);
  });

  it('does NOT flag body with error messages as vague', () => {
    const body = 'I get an error when running the install command. The exception is thrown on startup.';
    expect(isVagueIssue(body)).toBe(false);
  });

  it('does NOT flag body with steps to reproduce as vague', () => {
    const body = 'Steps to reproduce: 1. Clone the repo 2. Run npm start';
    expect(isVagueIssue(body)).toBe(false);
  });

  it('does NOT flag detailed body with 3+ sentences as vague', () => {
    const body = 'The application crashes when I try to login. I am using Chrome on Windows 10. ' +
      'The console shows a network error. The login form submits but nothing happens after that.';
    expect(isVagueIssue(body)).toBe(false);
  });

  it('flags body under 100 chars even with short sentences', () => {
    expect(isVagueIssue('i ran the install but nothing happens. its broken.')).toBe(true);
  });
});

describe('classifyIssue', () => {
  it('returns needs-more-info for vague issues without calling AI', async () => {
    const ai = mockAI('bug');
    const result = await classifyIssue('app wont start', 'its broken', ai);
    expect(result).toBe('needs-more-info');
  });

  it('returns the category when AI responds cleanly for detailed issues', async () => {
    const detailedBody = 'The application crashes when I try to login. I am using Chrome on Windows 10. ' +
      'The console shows a TypeError: Cannot read property of undefined. Stack trace attached below.';
    const result = await classifyIssue('App crashes on login', detailedBody, mockAI('bug'));
    expect(result).toBe('bug');
  });

  it('handles AI response with whitespace', async () => {
    const detailedBody = 'It would be really useful to have a dark mode option in the UI. ' +
      'Many users prefer dark mode for reduced eye strain. This could be a toggle in settings. ' +
      'Other similar tools already offer this feature.';
    const result = await classifyIssue('Add dark mode', detailedBody, mockAI('  feature  '));
    expect(result).toBe('feature');
  });

  it('extracts category from verbose AI response', async () => {
    const detailedBody = 'How do I install RepoKeeper on a Raspberry Pi? I have tried the steps in the README ' +
      'but I get a node version error. My Pi is running Debian Bookworm with Node 18.';
    const result = await classifyIssue('How to install on Raspberry Pi?', detailedBody, mockAI('This is a question from a user'));
    expect(result).toBe('question');
  });

  it('falls back to question for unrecognised response', async () => {
    const detailedBody = 'I have been looking at the code and I think there might be an issue with ' +
      'how the configuration is loaded. The documentation mentions a config file but I cannot find it. ' +
      'Could someone help me understand this better?';
    const result = await classifyIssue('Configuration confusion', detailedBody, mockAI('I am not sure what this is'));
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
  it('maps needs-more-info to needs-more-info', () => expect(categoryToLabel('needs-more-info')).toBe('needs-more-info'));
});
