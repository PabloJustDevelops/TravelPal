# Project management

## Issues

- Types: `bug`, `feature`, `enhancement`, with templates in `.github/ISSUE_TEMPLATE/`.
- Clear titles, and acceptance criteria in the body.
- Triage roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`; see
  [`docs/agents/triage-labels.md`](./agents/triage-labels.md).

## Milestones

- One milestone per sprint or release; assign the issues that belong to it.
- Suggested naming: `Sprint-YYYY-MM-DD` or `Release-vX.Y`.

## Project board

- Columns: `To Do`, `In Progress`, `Done`.
- Built-in issue status automation can move cards; no custom rules are required.

## Wiki

The GitHub Wiki is not enabled. `docs/` is the canonical documentation, with ADRs in
`docs/DECISIONS/` and the project context in `CONTEXT.md`.
