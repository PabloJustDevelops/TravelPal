# Tester Army in TravelPal

## Initial scope

`e2e@0.19.0` and `@e2e-dev/web@0.14.0` are added as a complementary suite. Playwright
still covers flows with data and axe; Jest keeps unit and component tests. Existing
tests are not migrated to a runner with different APIs.

`e2e.config.ts` runs `tests/**/*.e2e.ts` in Chromium at 1440×900 and 390×844. There are
three cases: access to a protected route, login options and password recovery. They use
exact locators and assertions. There are no `agent.*` steps, no AI authentication and
no model calls.

## Running

Requires Node 22.22.3+ on the 22 line or Node 24.8+. CI pins 22.22.3.

```bash
pnpm install --frozen-lockfile
NEXT_PUBLIC_INSFORGE_URL=https://insforge.example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=public-test-anon-key pnpm run build
pnpm run validate:static-export
pnpm exec e2e-web install chromium --with-deps
pnpm run test:tester
E2E_BASE_URL=https://travelpal.prg-dev.workers.dev pnpm run test:tester
```

Without `E2E_BASE_URL`, the runner starts or reuses Wrangler on localhost:3000 to serve
`out/`; the static export must therefore exist before running the suite locally. The
two public InsForge values are passed to the Wrangler process, which serves the already
built files and needs no private key. In CI, the workflow downloads the `out/` artifact
from the build before starting the suites. Against a remote URL it starts no server and
requires no local build.

Reports live in `.e2e/` (ignored). `pnpm run test:tester` disables telemetry; CI keeps
the report for seven days. The gate runs after Playwright and is part of the
precondition for deploy. Do not update snapshots automatically in CI.

## What it allows and what remains to be assessed

- Exact tests without AI, goals with `agent.act`, assertions with an agent, exploration
  and bug bash.
- Cache of verified actions: `act` can be replayed; `assert`, `waitFor` and `extract`
  with the integrated agent still query the model.
- Visual comparison with baselines generated and reviewed on the same system as CI
  (Linux).
- ChatGPT subscription through its own OAuth (`e2e login openai`), or providers with an
  API key. Neither has been configured, and the Codex auth file is not used.

The narrow viewport checks responsive behavior in desktop Chromium: it does not test
Safari/iOS, touch interactions or real push. Exploration with models requires an
explicit provider and budget; it is not part of a deterministic gate. To explore flows
that write, use a test account and test data with cleanup, never the owner's personal
data.

Secret redaction in the runner does not replace artifact review: videos and binary
downloads can keep visible data. The initial tests only navigate public screens.

## Documentation consulted

- [Full index](https://e2e.tester.army/docs/llms.txt)
- [Quickstart](https://e2e.tester.army/docs/quickstart)
- [Web and viewports](https://e2e.tester.army/docs/web)
- [Configuration](https://e2e.tester.army/docs/reference/config)
- [GitHub Actions](https://e2e.tester.army/docs/ci/github-actions)
- [Playwright migration](https://e2e.tester.army/docs/migrate/playwright)
- [App authentication](https://e2e.tester.army/docs/authentication)
- [Visual comparison](https://e2e.tester.army/docs/visual-testing)
- [Exploration](https://e2e.tester.army/docs/explore) and [bug bash](https://e2e.tester.army/docs/bug-bash)
- [Models](https://e2e.tester.army/docs/models) and [subscriptions](https://e2e.tester.army/docs/subscriptions)
- [Security](https://e2e.tester.army/docs/security) and [telemetry](https://e2e.tester.army/docs/telemetry)
