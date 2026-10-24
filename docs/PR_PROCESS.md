# Pull request process

A pull request is the only route into `main`. Pushing to `main` runs the full CI pipeline and, when
every job passes, publishes the static export to production, so a merge is a deploy.

## For authors

### Pre-PR checklist

Testing and quality:

- [ ] Tests pass locally: `pnpm test`
- [ ] Lint reports no errors: `pnpm run lint`
- [ ] Types check: `pnpm run type-check`
- [ ] Build succeeds: `pnpm run build`
- [ ] The change works in development: `pnpm run dev`
- [ ] Responsive layout checked, if the change touches UI
- [ ] Basic accessibility checked (labels, focus order, contrast)

Documentation:

- [ ] `README.md` updated if setup or commands changed
- [ ] Comments on the non-obvious parts of the code
- [ ] Technical docs under `docs/` updated
- [ ] User-visible changes described in the PR body

Git:

- [ ] Branch up to date with `main`
- [ ] Commit messages follow [`COMMITS.md`](./COMMITS.md)
- [ ] History clean enough to squash into one commit
- [ ] Branch name describes the change

### Title

The title follows the commit convention, because the squash commit inherits it and
`.github/workflows/commitlint.yml` validates the PR commits with `wagoid/commitlint-github-action`.

```
type(scope): short description
```

```
# Good
feat(auth): implement Google OAuth login
fix(booking): compute prices with discounts
docs(api): update endpoint documentation

# Avoid
fix bug
update code
changes
```

### Description

Fill in `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description

What the change does and why.

## Related

Closes #

## Checklist

- [ ] Lint passes (`pnpm run lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] Documentation updated if needed
- [ ] Review checklist completed (see `docs/code-review-checklist.md`)
```

Add these sections when they carry information the reviewer needs:

````markdown
## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation
- [ ] Style or formatting, no logic change
- [ ] Refactor
- [ ] Performance
- [ ] Tests
- [ ] Build, dependencies or tooling

## How it was tested

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] Browsers checked
- [ ] Mobile devices checked

## Screenshots

Before | After
-------|------
![before](url) | ![after](url)
````

### Labels

The labels in use are defined in `.github/labels.json` and created by
`.github/workflows/setup-labels.yml`. A label that is not in that file does not exist; add it there
instead of typing it on one PR.

| Label | Description | When to use |
|-------|-------------|-------------|
| `bug` | Something is not working | Bug fixes |
| `feature` | New functionality | New features |
| `enhancement` | Improvement or refactor | Changes to existing behaviour |
| `documentation` | Documentation only | Docs changes |
| `needs-triage` | Maintainer has to evaluate it | New PR without an owner yet |
| `needs-info` | Waiting on the author | Missing reproduction or context |
| `ready-for-agent` | Fully specified, ready for an agent | Work an agent can take unattended |
| `ready-for-human` | Requires human implementation | Design calls, credentials, judgement |
| `good first issue` | Good for newcomers | Small, self-contained work |
| `help wanted` | Extra attention needed | Work looking for an owner |
| `question` | Further information requested | Unclear scope |
| `duplicate` | Already exists | Repeat report or PR |
| `invalid` | Does not apply | Off-topic or unreproducible |
| `wontfix` | Will not be worked on | Rejected, with the reason in the thread |

### Author practices

Size:

- Under 400 changed lines: reviewable in one pass.
- 400 to 800: state the reading order in the description.
- Above 800: split. One PR per concern, or a stacked series.

Focus:

- One objective per PR: one feature, one bug, one improvement.
- Only changes that serve that objective.
- Explain the reason, not only the mechanism.

Communication:

- Mention the reviewers who own the affected area.
- Answer review comments; if you disagree, say why and propose an alternative.
- Push requested changes promptly, or state when they will land.

## For reviewers

### Review checklist

Architecture and design:

- [ ] The solution addresses the problem stated in the description
- [ ] The structure matches the project (`src/app` for routes, `src/components`, `src/lib`)
- [ ] Established patterns are followed
- [ ] Responsibilities are separated
- [ ] Existing code is reused where it already covers the case

Code quality:

- [ ] Readable without extra explanation
- [ ] Style consistent with the file and the project
- [ ] Comments where the logic is not self-evident
- [ ] Variables and functions named for what they hold or do
- [ ] No duplicated logic

Security and performance:

- [ ] No evident vulnerability
- [ ] No hardcoded secrets or keys; values come from `.env.local` or CI secrets
- [ ] No query or render cost that the change does not justify
- [ ] Error paths handled: loading, empty and failure states
- [ ] Data access respects the RLS policies

Testing:

- [ ] Tests cover the new behaviour
- [ ] Edge cases are covered, not only the happy path
- [ ] Tests are focused and their names state the expectation
- [ ] The suite passes consistently

Documentation:

- [ ] Docs updated
- [ ] Comments explain why, not what
- [ ] `README.md` updated if commands or setup changed

### Comment types

Useful comments name the concern and propose a next step:

```markdown
# Suggestion
Could this use `useMemo` to avoid the re-render on every keystroke?

# Question
What makes this approach preferable to the existing helper in `src/lib/utils.ts`?

# Possible issue
This throws when `user` is null. A guard before the access would cover it.

# Acknowledgement
The empty state here is handled well; it was missing in the previous version.

# Knowledge sharing
`formatDate` in `src/lib/utils.ts` already handles this timezone case.
```

Avoid:

```markdown
# Vague
This does not look right

# No context
Change this

# No suggestion
This is wrong

# Personal
This code is terrible
```

### Review passes

1. Overview: read the description, identify the objective, judge the scope, decide where to focus.
2. Detail: read the diff line by line, check the tests, check the docs, look for regressions.
3. Local run: check out the branch, run the suite, exercise the change in the browser.

### Response times

| Priority | Target | Scope |
|----------|--------|-------|
| Critical | under 2 hours | Hotfixes, production bugs |
| High | under 24 hours | Blocking features |
| Normal | under 48 hours | Regular features |
| Low | under 72 hours | Docs, chores |

## Merge

### Criteria

Required:

- [ ] At least one approval (team convention; GitHub does not enforce it)
- [ ] Every CI job passes; `build`, `worker-build` and `lint-commits` are required checks
- [ ] Branch rebased on `main` when the diff overlaps recent work
- [ ] Review conversations resolved
- [ ] Labels set

Quality:

- [ ] Test coverage maintained or improved
- [ ] No merge conflict
- [ ] Documentation complete
- [ ] No regression introduced

### Strategies

Squash and merge is the default: one commit per PR on `main`, with the PR title as the subject.

```bash
# Result: one commit on main
feat(auth): implement Google OAuth login (#123)

- Add LoginButton component
- Integrate the Google OAuth API
- Add tests for the authentication flow
- Update the auth documentation

Co-authored-by: Reviewer Name <email@example.com>
```

Merge commit, when the branch history carries information the squash would lose:

```bash
# Result: branch history preserved
Merge pull request #123 from feature/google-login

feat(auth): implement Google OAuth login
```

Rebase and merge, when the branch already holds clean, individually meaningful commits:

```bash
# Result: individual commits on main
feat(auth): add LoginButton component
feat(auth): integrate the Google OAuth API
test(auth): add tests for the authentication flow
```

After the merge, delete the branch. A merge into `main` triggers `deploy`; watch it until
`e2e-produccion` passes.

## CI

`.github/workflows/ci.yml` runs on every pull request and on every push to `main`, with Node
22.22.3 and pnpm.

| Job | Depends on | What it does |
|-----|-----------|--------------|
| `build` | - | Lint, type-check, Jest, RLS tests, timezone test, data-path guard, `pnpm run build`, static export validation, header and SEO checks, Storybook build, upload of `out/` |
| `worker-build` | `build` | Downloads the artifact, validates it, runs `wrangler deploy --dry-run --no-autoconfig` |
| `e2e` | `build` | Playwright against the exported artifact (`.github/workflows/e2e.yml`) |
| `deploy` | `build`, `worker-build`, `e2e` | Only on push to `main`: publishes the artifact with `wrangler deploy --no-autoconfig` |
| `e2e-produccion` | `deploy` | Only on push to `main`: Playwright against `https://travelpal.prg-dev.workers.dev` |

A pull request therefore runs `build`, `worker-build` and `e2e`; `deploy` and `e2e-produccion` never
run on a PR.

Additional workflows: `commitlint.yml` validates the commit messages of a PR, `setup-labels.yml`
creates the labels in `.github/labels.json` when that file changes on `main`.

### Useful commands

```bash
# PRs where my review is still required
gh pr list --state open --search "review:required"

# Every PR with title, author and date
gh pr list --state all --json number,title,author,createdAt

# PRs opened by me
gh pr list --author @me --state all

# Reviews requested from me
gh pr list --review-requested @me

# Run the PR checks locally
gh pr checks

# Full pipeline before pushing
pnpm run lint && pnpm run type-check && pnpm test && pnpm run build
```

## Metrics

| Metric | Target | Source |
|--------|--------|--------|
| Review time | under 24 hours | GitHub Insights |
| Merge time | under 48 hours | GitHub API |
| Average PR size | under 400 lines | `gh pr list --json additions,deletions` |
| Merge conflicts | under 5% | `git log` |

## Special cases

### Production hotfix

```markdown
## HOTFIX

### Problem
Description of the production bug.

### Fix
The minimal change that resolves it.

### Urgency

- [ ] Users are affected in production
- [ ] The fix is minimal and scoped
- [ ] Critical tests pass
- [ ] Deploy required immediately
```

Branch from `main`, keep the diff to the fix, request a fast review from the maintainer, and watch
`deploy` and `e2e-produccion` after the merge.

### Experimental PR

```markdown
## EXPERIMENTAL

### Objective
Test concept X to judge whether it is viable.

### Warnings

- Not for production
- May need substantial rework
- Feedback welcome
```

Mark the PR as a draft until the concept holds.

## FAQ

When to open a draft PR:

- Work in progress that needs early feedback
- A feature with more than one contributor
- A change of approach that should be validated before the work is finished

Conflicting review feedback: discuss it in the PR, look for consensus between the reviewers, and
escalate to the maintainer if they disagree.

Obsolete PRs: rebase on `main` if the intent still holds, close it with the reason if it does not,
and open a fresh PR if the diff has drifted too far to rebase.

## Related documentation

- [`BRANCHING.md`](./BRANCHING.md) - branch strategy
- [`COMMITS.md`](./COMMITS.md) - commit conventions
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - contribution guide
- [`code-review-checklist.md`](./code-review-checklist.md) - review checklist

External references:

- [GitHub code review](https://github.com/features/code-review/)
- [Google engineering practices: code review](https://google.github.io/eng-practices/review/)
- [Conventional Comments](https://conventionalcomments.org/)
