# Rollback of assets-only Workers

The last commit before the authentication and static export migration is `523d0a8`.
`b86d853` already contains the SPA changes and `output: 'export'`, so restoring only its
OpenNext configuration is not a functional rollback.

If the branch keeps the commit sequence of this migration from `523d0a8`, revert the
whole range with new commits, review the diff and publish it to `main` to activate the
restored OpenNext workflow:

```sh
git switch -c codex/rollback-static-workers
git revert --no-commit 523d0a8..HEAD
git diff --check
git diff
git commit -m "Revierte la migración a Workers estáticos"
git push -u origin codex/rollback-static-workers
```

Open a PR from that branch to `main`; merging it activates the restored OpenNext
workflow. Run that range only when it contains this migration and no unrelated work. If
the integration landed as a single squash commit, create the branch from `main` and
revert that commit instead. Do not use `git reset` or `git push --force`.

`pnpm exec opennextjs-cloudflare build` was tested in the static state with fake public
values: Next compiles, but OpenNext fails while bundling because
`.next/standalone/.next/server/pages-manifest.json` is missing. The rollback must
therefore also restore the auth and routes from before `output: 'export'`; this file
does not claim that OpenNext works in the static state.
