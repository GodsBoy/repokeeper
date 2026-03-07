# Contributing to RepoKeeper

Thank you for your interest in contributing to RepoKeeper! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/repokeeper.git`
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feat/your-feature`

## Development Setup

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript
pnpm dev              # Run with tsx (auto-reload)
pnpm test             # Run tests
pnpm lint             # Lint with ESLint
pnpm format           # Format with Prettier
```

## Making Changes

### Code Style

- TypeScript strict mode is enforced
- Use ESLint and Prettier for consistent formatting
- Run `pnpm lint` and `pnpm format` before committing

### Commit Messages

Follow conventional commit format:

- `feat: add new feature`
- `fix: resolve bug in classifier`
- `docs: update README`
- `test: add tests for duplicate detection`
- `refactor: simplify config loading`
- `chore: update dependencies`

### Tests

- Write tests for all new functionality
- Use Vitest as the test framework
- Ensure `pnpm test` passes before opening a PR
- Aim for meaningful test coverage of edge cases

### Pull Requests

1. Ensure your branch is up to date with `main`
2. Run `pnpm build` and `pnpm test` to verify everything works
3. Write a clear PR description explaining what changed and why
4. Link any related issues

## Reporting Issues

- Use the GitHub issue tracker
- Include steps to reproduce bugs
- Provide your environment details (Node.js version, OS, etc.)
- Check for existing issues before creating a new one

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## Licence

By contributing, you agree that your contributions will be licensed under the MIT Licence.
