# Branch strategy

Git workflow for TravelPal. The model is GitHub Flow: `main` is always deployable, work happens on
short-lived branches, and every change reaches `main` through a pull request.

## `main`

| Property | Value |
|----------|-------|
| Purpose | Stable, deployable code |
| Protection | Force pushes and deletion disabled; required checks |
| Updates | Pull requests only |
| Deployment | Automatic on push |
| Requirements | CI green, review approved |

Protection rules currently configured on `main`:

- Required status checks: `build`, `worker-build`, `lint-commits`.
- Force pushes rejected.
- Branch deletion rejected.
- `strict` mode is off, so a branch does not have to be rebased on `main` before merging; do it
  anyway when the diff overlaps recent work.
- GitHub does not require an approving review; one approval is the team convention and the reviewer
  enforces it.

A merge into `main` runs the `deploy` job and then `e2e-produccion` against
`https://travelpal.prg-dev.workers.dev`, so the branch state and the published site move together.

## Working branches

### Feature branches

```bash
# Naming
feature/<short-description>
feature/<issue-number>-<description>

# Examples
feature/google-login
feature/123-flight-search
feature/user-dashboard
```

- Purpose: new functionality.
- Lifetime: short, one to five days.
- Origin: current `main`.
- Destination: `main`, through a PR.

```bash
# 1. Update main
git checkout main
git pull origin main

# 2. Create the branch
git checkout -b feature/new-feature

# 3. Develop and commit
git add .
git commit -m "feat: add new feature"

# 4. Push and open the PR
git push origin feature/new-feature
```

### Fix branches

```bash
# Naming
fix/<bug-description>
fix/<issue-number>-<description>

# Examples
fix/login-error
fix/456-price-calculation
fix/mobile-layout
```

- Purpose: correction of incorrect behaviour.
- Priority: high for production bugs.
- Origin: `main`, or the branch that carries the defect.
- Production bugs may take a fast track; see the hotfix section.

### Chore branches

```bash
# Naming
chore/<task-description>

# Examples
chore/update-dependencies
chore/configure-eslint
chore/improve-docs
```

- Purpose: maintenance, configuration, refactoring.
- Includes: docs, dependencies, config, tooling.
- Impact: none on user-facing behaviour.

## Full workflow

1. Preparation

```bash
git checkout main
git pull origin main
git status
```

2. Branch

```bash
git checkout -b type/clear-description
git branch --show-current
```

3. Develop

```bash
git add changed-file.ts
git commit -m "type(scope): clear description"

# Regular push as a backup
git push origin branch-name
```

4. Keep up to date

```bash
git checkout main
git pull origin main
git checkout your-branch
git rebase main   # or: git merge main
```

5. Prepare the PR

```bash
git status
pnpm run lint
pnpm run type-check
pnpm test
pnpm run build
git push origin your-branch
```

6. Pull request

1. Open the PR against `main`.
2. Fill in `.github/PULL_REQUEST_TEMPLATE.md`.
3. Set the labels from `.github/labels.json`.
4. Request a review.
5. Merge once the checks pass and the review is approved.

## Merge policy

Squash and merge is the default: one commit per feature, easy to revert, with a consolidated message.

```
type(scope): clear description of the feature (#PR)

- Detail of what was implemented
- Detail of what was implemented
Fixes #issue-number
```

| Strategy | When | Result |
|----------|------|--------|
| Squash and merge | Default | One clean commit |
| Merge commit | Complex features with several contributors | Branch history preserved |
| Rebase and merge | Branch already holds clean commits | Linear history |

## Special cases

### Production hotfix

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-description

# 2. Minimal fix and test
pnpm test

# 3. PR with high priority
git push origin hotfix/critical-description
```

Open the PR with `bug` and `ready-for-human`, and note the production impact in the description.

### Long-lived branches

Avoid them. When one is unavoidable:

```bash
git checkout main
git pull origin main
git checkout feature/large-feature
git rebase main

# Or merge when the conflicts are structural
git merge main
```

Split the work into PRs that land on `main` instead of keeping a long branch alive.

### Experimental branches

```bash
experiment/experiment-name
poc/proof-of-concept
```

These do not have to reach `main`. Delete them when the experiment ends, and record the conclusion in
an ADR under `docs/DECISIONS/` if it changes a decision.

## Monitoring

| Metric | Target | Source |
|--------|--------|--------|
| Branch lifetime | under 5 days | GitHub Insights |
| PR size | under 400 lines | `gh pr list --json additions,deletions` |
| Review time | under 24 hours | GitHub metrics |
| Merge conflicts | under 5% | `git log` |

```bash
# Active branches
git branch -a

# Branches already merged
git branch --merged main

# Delete merged local branches
git branch --merged main | grep -v main | xargs git branch -d

# Commit activity
git shortlog -sn --since="1 month ago"
```

## Tools

CI enforces the checks that matter; there is no local git hook in the repository. To run the same
checks before pushing, use the scripts in `package.json`:

```bash
pnpm run lint && pnpm run type-check && pnpm test
```

A `pre-push` hook is optional and not versioned. If you add one locally:

```bash
# .git/hooks/pre-push
#!/bin/sh
pnpm test || { echo "Tests failed. Push aborted."; exit 1; }
```

Useful aliases for `~/.gitconfig`:

```bash
[alias]
  co = checkout
  br = branch
  ci = commit
  st = status
  unstage = reset HEAD --
  last = log -1 HEAD

  # Create a feature branch from an updated main
  feature = "!f() { git checkout main && git pull && git checkout -b feature/$1; }; f"

  # Delete merged branches
  cleanup = "!git branch --merged main | grep -v main | xargs git branch -d"
```

## FAQ

When to create a branch: for any change that is not trivial, always for a feature, always for a bug
fix, and for documentation changes that touch several files.

Resolving conflicts:

```bash
# During a rebase
git rebase main
# Resolve each conflict, then
git add resolved-file.ts
git rebase --continue

# During a merge
git merge main
git add .
git commit -m "chore: resolve conflicts with main"
```

Rebase or merge: rebase to keep a linear history on a branch nobody else is using; merge when the
branch is shared and its context matters.

## Related documentation

- [`COMMITS.md`](./COMMITS.md) - commit conventions
- [`PR_PROCESS.md`](./PR_PROCESS.md) - pull request process
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - contribution guide

External references:

- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Git branching workflows](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows)
- [Conventional Commits](https://www.conventionalcommits.org/)
