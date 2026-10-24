# Commit conventions

Semantic commits keep the history readable, make individual changes searchable, and allow reverts
that target one change instead of a batch.

## Format

```
type(scope): short description

[optional body]

[optional footer]
```

Rules:

- Header line: 72 characters recommended; commitlint rejects anything above 100.
- Type: lowercase, from the list below.
- Description: imperative mood, no trailing period.
- Body: optional, separated from the header by one blank line. Explain what changed and why.
- Footer: optional, for breaking changes and issue references.

## Allowed types

`.commitlintrc.json` extends `@commitlint/config-conventional` and restricts `type-enum` to seven
values. A commit with any other type fails the check.

| Type | Use for |
|------|---------|
| `feat` | New functionality visible to users |
| `fix` | Correction of incorrect behaviour |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, semicolons; no logic change |
| `refactor` | Code change that neither adds functionality nor fixes a bug |
| `test` | Adding or correcting tests |
| `chore` | Dependencies, configuration, build, tooling |

`subject-case` accepts `sentence-case` or `lower-case`. A subject in Title Case fails.

The Conventional Commits specification also defines `perf`, `ci`, `build` and `revert`. This
repository does not accept them; use `chore` with a scope that names the area (`chore(ci)`,
`chore(deps)`, `chore(build)`).

## Scopes

The scope is optional. It stays lowercase, like the type.

By feature: `auth`, `booking`, `search`, `payment`, `dashboard`, `budget`.

By layer: `api`, `db`, `ui`, `config`.

By component: `header`, `sidebar`, `modal`.

By area, when the change cuts across features: `ui`, `config`, `deps`.

```bash
# Authentication
feat(auth): add Google login
fix(auth): correct token validation

# Booking
feat(booking): add seat selection
fix(booking): compute prices with discounts

# Search
feat(search): add advanced flight filters
chore(search): optimize API queries

# Dashboard
feat(dashboard): add statistics charts
style(dashboard): improve responsive layout
```

```bash
# Backend and data
feat(api): add notifications endpoint
fix(api): handle 500 responses
feat(db): add users table migration
fix(db): add indexes for slow queries

# Frontend
feat(ui): add DatePicker component
fix(ui): keep modal open on mobile

# Tooling
chore(config): update ESLint rules
chore(ci): add deploy workflow
```

```bash
# No scope
feat: add contact page
fix: correct typo in README

# Several areas
feat(auth,ui): add redesigned login
fix(api,db): synchronize trip data
```

## Examples

A short commit is a single line. A larger one uses the body to record the parts and the reason.

```bash
# Correct
feat(search): add airline filter

feat(booking): implement Stripe payments

Allow users to pay for a booking with a credit card through
the Stripe API.

- Add PaymentForm component
- Integrate Stripe Elements
- Handle confirmation webhooks
- Add tests for the payment flow

Closes #123
```

```bash
fix(auth): log out correctly in Safari

fix(booking): compute prices with discounts

The discount calculation ignored taxes, which produced wrong
totals at checkout.

- Apply discounts before computing taxes
- Validate discounts above 100%
- Update pricing tests

Fixes #456
```

```bash
docs: update installation guide
docs(api): add search endpoint examples

- Request and response examples
- Common error codes
- Rate limiting
```

```bash
chore(deps): upgrade React to 18.2.0
chore(eslint): add rules for hooks
chore(build): reduce bundle size

Reduce the main bundle from 2.1 MB to 1.8 MB through better
tree shaking, per-route code splitting and gzip compression.
```

## What to avoid

```bash
# Too vague
fix: bug

# No type
add new feature

# Title too long
feat(booking): implement the complete booking system with payment, confirmation, emails and push notifications

# Not imperative
feat(auth): added login functionality

# Unrelated changes in one commit
feat(auth): login + fix search bug + update docs

# Type used as scope
feat(fix): correct login error

# Scope too generic
feat(app): new functionality
```

Corrected:

```bash
fix(auth): correct login validation error
feat(auth): implement Google OAuth login
feat(booking): add booking system with payment

Implement the full booking flow:

- Flight and seat selection
- Stripe payment integration
- Email confirmation
- Push notifications

# One change per commit
feat(auth): implement Google login
fix(search): correct date filters
docs(readme): update installation guide
```

## Breaking changes

Mark the commit with `!` after the type or scope, and describe the change in a `BREAKING CHANGE:`
footer.

```bash
feat(api)!: change user response format

BREAKING CHANGE: /api/users now returns a different object
structure. See the ADR in docs/DECISIONS/ for the rationale.
```

```bash
feat(api): restructure the user response

BREAKING CHANGE: the `name` field is split into `firstName` and
`lastName`. Client code must use the new structure.

Before:
{
  "name": "Jane Doe"
}

After:
{
  "firstName": "Jane",
  "lastName": "Doe"
}
```

Checklist for a breaking change:

- [ ] `!` in the header or `BREAKING CHANGE:` in the footer
- [ ] The change is described in detail in the body
- [ ] A migration guide exists
- [ ] API documentation is updated
- [ ] Tests cover the new behaviour
- [ ] The team knows before the merge

## Issue references

| Keyword | Effect | When to use |
|---------|--------|-------------|
| `Fixes #123` | Closes the issue | Bug fixes |
| `Closes #123` | Closes the issue | Completed features |
| `Resolves #123` | Closes the issue | Any resolution |
| `Related to #123` | Reference only | Partial work |
| `See #123` | Reference only | Additional context |

```bash
fix(auth): correct login timeout

Fixes #234
```

```bash
feat(search): add advanced flight filters

Filter by airline, departure time, number of stops and maximum
price.

Closes #123, #124, #125
```

```bash
refactor(api): restructure endpoints

Preparation for the cache work in #456. Does not close the issue.

Related to #456
```

## Tooling

Commit messages are validated by commitlint. The configuration lives in `.commitlintrc.json`:

```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [2, "always", ["feat", "fix", "docs", "chore", "refactor", "test", "style"]],
    "subject-case": [2, "always", "sentence-case", "lower-case"]
  }
}
```

`.github/workflows/commitlint.yml` runs `wagoid/commitlint-github-action` on every pull request that
is opened, edited or synchronized, so a non-conforming commit blocks the PR. There is no local git
hook in this repository; run the check by hand before pushing if the message is unusual:

```bash
pnpm exec commitlint --from origin/main --to HEAD
```

## Workflow

Before the commit:

```bash
git status
git diff

git add src/components/LoginForm.tsx
git add src/tests/LoginForm.test.tsx

# Only when every staged file belongs to the same change
git add .
```

Writing the commit:

```bash
git commit -m "feat(auth): implement Google OAuth login"

# Editor, for a message with body and footer
git commit
```

After the commit:

```bash
git log -1 --oneline
git show HEAD

# Not pushed yet
git commit --amend
```

## Commands

```bash
# History
git log --oneline --graph --decorate
git log --oneline --grep="feat:"
git log --oneline --grep="fix:"
git log --author="name" --oneline
git shortlog -sn --since="1 month ago"
git log v1.0.0..v1.1.0 --oneline
```

```bash
# Correcting commits
git commit --amend -m "corrected message"
git commit --amend --author="Name <email@example.com>"
git revert HEAD
git revert HEAD~3..HEAD
```

## Template and aliases

A message template keeps the structure in front of you:

```bash
# ~/.gitmessage
# type(scope): short description (max 72 characters)
#
# What changed and why (optional)
# - What changed
# - Why it changed
# - How it affects users
#
# Fixes #123
# Closes #456
```

```bash
git config --global commit.template ~/.gitmessage
```

Aliases for `~/.gitconfig`:

```bash
[alias]
  # Short commits
  cf = "!f() { git commit -m \"feat: $1\"; }; f"
  cx = "!f() { git commit -m \"fix: $1\"; }; f"
  cd = "!f() { git commit -m \"docs: $1\"; }; f"

  # History
  lg = log --oneline --graph --decorate --all
  last = log -1 HEAD --stat

  # Filter by type
  feat = log --oneline --grep="feat:"
  fixes = log --oneline --grep="fix:"
```

## Splitting large changes

```bash
# Avoid
git commit -m "feat: implement the whole booking system"

# Split by layer
git commit -m "feat(booking): add booking model"
git commit -m "feat(booking): add API endpoints"
git commit -m "feat(booking): add UI components"
git commit -m "test(booking): add unit tests"
```

When a commit is wrong: amend it if it has not been pushed. Once pushed, add a correcting commit.
For a bad change that is already merged, revert it and commit the replacement.

## Related documentation

- [`BRANCHING.md`](./BRANCHING.md) - branch strategy
- [`PR_PROCESS.md`](./PR_PROCESS.md) - pull request process
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - contribution guide

External references:

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Angular commit guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
