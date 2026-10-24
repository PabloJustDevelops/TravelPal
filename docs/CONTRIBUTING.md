# Contributing

## First steps

Read these before changing anything:

- [`README.md`](../README.md) - project overview
- [`docs/TECHNICAL.md`](./TECHNICAL.md) - technical setup
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) - system architecture

Local setup:

1. Fork the repository.
2. Clone your fork.
3. Create `.env.local` (see `TECHNICAL.md` for the required variables).
4. Install dependencies: `pnpm install`.
5. Check that it runs: `pnpm run dev`.

## Workflow

### 1. Create a branch

```bash
git checkout main
git pull origin main

git checkout -b feature/descriptive-name
git checkout -b fix/bug-description
git checkout -b chore/maintenance-task
```

Branch naming and the full flow are in [`BRANCHING.md`](./BRANCHING.md).

### 2. Develop

- Follow [`CODE_STYLE.md`](./CODE_STYLE.md).
- Add tests for new behaviour.
- Update documentation when behaviour or setup changes.
- Run `pnpm run lint` as you go.

### 3. Commit

Follow [`COMMITS.md`](./COMMITS.md). Commitlint accepts `feat`, `fix`, `docs`, `chore`, `refactor`,
`test` and `style`; the subject is lowercase or sentence case.

```bash
git commit -m "feat(auth): add Google login"
git commit -m "fix(budget): correct total calculation"
git commit -m "docs(readme): update installation steps"
```

### 4. Pull request

1. Push the branch: `git push origin your-branch-name`.
2. Open the PR against `main`.
3. Fill in the template.
4. Request a review.

## Quality standards

Before pushing:

| Check | Command | Expected |
|-------|---------|----------|
| Lint | `pnpm run lint` | No errors |
| Types | `pnpm run type-check` | No errors |
| Tests | `pnpm test` | All pass |
| Build | `pnpm run build` | Succeeds |
| Autofix | `pnpm exec eslint --fix` | Fixes what it can |

Not every one of these runs on save, so run them by hand before opening the PR. The same commands
run in CI, plus the RLS, timezone, static export, header and SEO checks.

### Code conventions

- TypeScript: explicit types wherever the inference is not obvious.
- Components: PascalCase.
- Files and folders: kebab-case.
- Functions and variables: camelCase.
- Constants: UPPER_SNAKE_CASE.

### Testing

```bash
# All tests
pnpm test

# Watch mode
pnpm run test:watch

# With coverage
pnpm run test:coverage
```

Requirements:

- New behaviour ships with tests.
- Unit tests for business logic.
- Component tests for interactive UI.
- Coverage thresholds live in `jest.config.js` and are set to the current baseline (global:
  branches 2, functions 2, lines 5, statements 5). They are raised as coverage grows; a change that
  lowers coverage fails the run.

## Contribution types

### Report a bug

1. Search the existing issues first.
2. Open an issue with the `bug` template (`.github/ISSUE_TEMPLATE/bug.yml`) and the `bug` label.
3. Include:
   - What happens, and where
   - Steps to reproduce
   - Expected behaviour against actual behaviour
   - Screenshots if they help
   - Environment: OS, Node version, browser

### Propose a feature

1. Open an issue with the `feature` template and the `feature` label.
2. Describe:
   - The problem it solves
   - The proposed solution
   - Alternatives considered
   - Mockups or wireframes if they exist

### Improve documentation

- Use the `documentation` label.
- Keep the tone plain and concise.
- Add examples where they shorten the explanation.
- Check that the links resolve.

### Maintenance

- Dependency updates
- Performance work
- Refactoring
- Tooling configuration

## Review

### Author checklist

Before requesting review:

- [ ] The description states what changed and why
- [ ] Related issues are referenced
- [ ] Tests and lint pass
- [ ] Documentation updated if needed
- [ ] Branch rebased on `main`
- [ ] The change was exercised manually

### Reviewer checklist

- [ ] The code follows the project conventions
- [ ] Public APIs are not broken without a `BREAKING CHANGE` note
- [ ] Error paths are handled
- [ ] Names and structure are consistent with the surrounding code
- [ ] Performance cost is justified
- [ ] Security considered: no secrets, RLS respected

Full process: [`docs/PR_PROCESS.md`](./PR_PROCESS.md). Item-by-item list:
[`docs/code-review-checklist.md`](./code-review-checklist.md).

## Labels

The labels in use are defined in `.github/labels.json` and loaded by
`.github/workflows/setup-labels.yml`.

| Label | Description | Colour |
|-------|-------------|--------|
| `bug` | Error or problem | `#d73a4a` |
| `feature` | New functionality | `#a2eeef` |
| `enhancement` | Improvement or refactor | `#a2eeef` |
| `documentation` | Documentation changes | `#0075ca` |
| `needs-triage` | Maintainer has to evaluate it | `#fbca04` |
| `needs-info` | Waiting on the reporter | `#d876e3` |
| `ready-for-agent` | Fully specified, ready for an agent | `#0e8a16` |
| `ready-for-human` | Requires human implementation | `#1d76db` |
| `wontfix` | Will not be actioned | `#ffffff` |
| `good first issue` | Good for newcomers | `#7057ff` |
| `help wanted` | Extra attention needed | `#008672` |
| `question` | Further information requested | `#d876e3` |

Issue triage roles are described in [`docs/agents/triage-labels.md`](./agents/triage-labels.md).

## Communication

- Issues: technical discussion and bug reports.
- Pull requests: code review.
- GitHub Discussions is not enabled on this repository.

Guidelines:

- Be specific: state what you expected and what happens.
- Keep the tone factual. Critique the change, not the author.
- Search the issues and the docs before asking.
- Include context: links, screenshots, logs.
- Write in English, matching the documentation.

## Recognition

Contributors are listed on the repository's GitHub contributors page and in the commit history.
There is no separate contributors file or bot.

## Getting help

- Issues: [github.com/PabloJustDevelops/TravelPal/issues](https://github.com/PabloJustDevelops/TravelPal/issues)
- Pull requests: [github.com/PabloJustDevelops/TravelPal/pulls](https://github.com/PabloJustDevelops/TravelPal/pulls)
- Maintainer: [@PabloJustDevelops](https://github.com/PabloJustDevelops)

New contributors:

1. Pick an issue labelled `good first issue`.
2. Read the documentation in `docs/`.
3. Set up the environment.
4. Open the PR.

## Related documentation

- [`BRANCHING.md`](./BRANCHING.md) - branch strategy
- [`COMMITS.md`](./COMMITS.md) - commit conventions
- [`PR_PROCESS.md`](./PR_PROCESS.md) - pull request process
- [`CODE_STYLE.md`](./CODE_STYLE.md) - code style
