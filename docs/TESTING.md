# Testing

| Level | Tool | Where it lives | Command |
| --- | --- | --- | --- |
| Unit and component | Jest + Testing Library | `src/**/__tests__/` | `pnpm run test:ci` |
| End-to-end with data | Playwright | `e2e/` | `pnpm run test:e2e` |
| Public access, desktop and narrow viewport | Tester Army (`e2e`) | `tests/*.e2e.ts` | `pnpm run test:tester` |

## Rule: no bug lands without the test that fails without the fix

Every fixed bug lands with the test that goes red on the previous code and green with the fix. The
net has to fail first: a test that cannot fail is worth nothing. The three failures that passed lint,
type-check, build and the 290 unit tests green (the record that did not persist, the blank dashboard
after signing in and the protected route bouncing back) were not detectable with unit tests, and each
one landed with its case in `e2e/smoke/`.

## E2E in local

The credentials of the dedicated e2e user are required (it is verified in production; the suite never
creates users):

```bash
export E2E_USER_EMAIL=<email of the dedicated user>
export E2E_USER_PASSWORD=<its password>
pnpm run test:e2e
```

If you would rather not export them in every shell, leave them in `.env.local` (it is in
`.gitignore`): the runner loads it. Credentials are never committed.

Before running E2E locally, export the real URL and the public anon key of the InsForge project the
test will use. The `example.invalid` value only serves to verify that the export compiles; it causes
DNS errors in flows that contact the backend. `INSFORGE_API_KEY` is not needed to serve the app:

```bash
export NEXT_PUBLIC_INSFORGE_URL="https://sjdq7zsn.eu-central.insforge.app"
export NEXT_PUBLIC_INSFORGE_ANON_KEY="<public anon key of the project>"
pnpm run build
pnpm run validate:static-export
```

Playwright starts `wrangler dev` through `scripts/e2e-server.mjs`, a supervisor that relaunches it
when it dies and kills the whole process group (the open `ProxyWorker` failure in
`cloudflare/workers-sdk#15203` left the port held and blocked deploys), to serve that export on port
3000, and reuses an existing local server. To watch the steps in the browser,
`pnpm exec playwright test --headed`; with `--debug`, step by step.

The suite runs in two projects: `smoke` in parallel and `flows` with `workers: 1`. The flows share the
dedicated user and may read or delete the data they create during the run, so they run one at a time.

## The two forms of the same suite

The target is chosen by `E2E_BASE_URL`, and defaults to localhost:

```bash
pnpm run test:e2e                      # local export served by Wrangler
E2E_BASE_URL=https://travelpal.prg-dev.workers.dev pnpm run test:e2e   # the deployed site
```

## What the stage 0 smoke covers

- `/signup`: valid form, submit and arrival at the verification step with the email pending. The code
  is not completed (there is no readable mailbox to go to).
- `/signin` with the dedicated user: dashboard **with content** (real title and navigation), not only
  the right URL.
- `/dashboard` without a session: ends at `/signin`, with no loop and no blank screen.
- `/signin` without a session: fills the form with synthetic data using the same helper as the real
  login, without submitting it. It checks showing and hiding the password again, without confusing the
  input with the visibility button.

## What stage 1 covers (flows with data)

Five specs with six cases in `e2e/flows/`, each with its own cleanup and an accessibility check with
`@axe-core/playwright` (no `critical` or `serious` violations on the screens where the axe helper is
called):

- `trips.spec.ts`: create a trip in `/create-trip`, see it in the detail and in the list, finding it by
  its title. Axe on the trips list.
- `expenses.spec.ts`: with a freshly created trip, record an associated expense, see it in `/expenses`
  and check that it adds up in the trip summary. Axe on the expenses list.
- `planning.spec.ts`: add an activity in the planner and check that it is still there after reloading
  (the per-operation persistence of #60, with no save button). Axe on the planner.
- `journal-photos.spec.ts`: upload a photo to the journal of a past trip and check that it renders with
  a signed URL; the `role="img"` slot of the fallback does not count as success. Axe on the trip detail.

The shared helpers live in `e2e/support/`: `flows.ts` (login, trip creation, axe check) and
`cleanup.ts` (trip deletion).

- `delete-trip.spec.ts`: delete a trip from the UI and check separately that a kept expense is left
  without a trip.

## Running only the flows that create data

```bash
pnpm exec playwright test e2e/flows                 # local, against Wrangler and out/
E2E_BASE_URL=https://travelpal.prg-dev.workers.dev pnpm exec playwright test e2e/flows
```

The `flows` project already limits itself to one worker, so there is no need to pass `--workers=1` by
hand.

## Deleting and cleaning up data

The list and the detail let you delete trips and decide what happens to their expenses and notes. The
calendar normalizes trip dates to show them in the grid. These failures were fixed in #81; they are not
current limitations.

The E2E use `e2e/support/cleanup.ts` as a safety cleanup, with the dedicated user's session and RLS. It
deletes the data and photos the test itself created. The deletion cases exercise the real UI action;
the others do not depend on it to clean up after a failure.

## Test data and traces

The data a test creates carries the prefix `e2e-` plus a timestamp and is deleted in the test itself.
Known exception: the sign-up case creates an unverified user that cannot be deleted (InsForge exposes
no endpoint to delete users), so one is left per run.

`trace: on-first-retry` and `retries: 2` in CI: a failure's trace stays in `test-results/` and the job
uploads it as an artifact (`playwright-trace`).

The accessibility cases of the dashboard and the detail generate screenshots in both themes at 1440
and 390 px. The dashboard has one capture of the empty state and another with a QA trip, activity, task
and budget with spend. The populated scenario creates a trip with the UI and inserts the auxiliary data
with the SDK under the E2E session; when it finishes, it deletes the task, budget, expense, activity and
trip associated with its unique names. To review the content under the first fold, it also saves
full-page captures of the populated mobile dashboard.

The job keeps the PNGs in `/tmp/travelpal-atlas-*.png` and `/tmp/travelpal-trip-*.png` for 7 days as
`atlas-qa-codigo` or `atlas-qa-produccion`, including when the suite passes. The captures serve to
review the empty and populated state of that run; they do not replace a visual review or a global
fidelity comparison.

## Tester Army

`pnpm run test:tester` runs three public cases in Chromium at 1440×900 and 390×844: protected route
redirect, sign-in options and password recovery. It creates no users, sends no emails and needs no
model or subscription. The narrow viewport checks responsive layout; it is not equivalent to Safari/iOS
or to a real touch device.

See [TESTER-ARMY.md](TESTER-ARMY.md) for configuration, limits and evolution.

## CI

The `e2e` job in `.github/workflows/ci.yml` calls the reusable suite
`.github/workflows/e2e.yml` on both PR and push to `main`, against the static artifact from the
build, served locally by Wrangler.
`deploy` waits for `build`, `worker` and `e2e`. After publishing, `e2e-produccion` runs both suites
against the Worker. CI pins Node 22.22.3.

It needs `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`; if they are missing, the job fails before the
login can be skipped. The whole job is serialized across branches because it shares a user and a
backend. New pushes to a PR cancel their previous CI; a `main` deploy is never cancelled.

Playwright's failure artifacts and the Tester Army report are kept for seven days. Tester Army
telemetry is disabled. There are no steps with models in the gate.

## Pending coverage

There is still no full coverage of real mobile, WebKit/Firefox, Google OAuth with a real provider, full
email verification, complete task/note CRUD, profile/settings or visual regression. Jest tests the push
client layer; it does not prove real delivery of notifications. The existing axe asserts are not a full
accessibility audit either.

## Components and isolated accessibility

`pnpm run storybook` opens the catalogue on localhost:6006 with real controls and forms, synthetic
data and a theme selector. `pnpm run build-storybook` generates the static catalogue locally (ignored
by Git; it is not published with the Worker).

`pnpm run test:storybook` uses Vitest exclusively for the stories, in real Chromium. Jest keeps the
unit and application tests. The accessibility addon has `a11y.test: error`: its violations fail the
test. CI builds the catalogue and runs these tests after installing Chromium.

`e2e/flows/forms-accessibility.spec.ts` verifies Tasks and Notes in light/dark at 390 and 1440 px:
labels, title error, radios with the keyboard, full axe inside the dialog, closing and focus
restoration. It saves no tasks or notes. It waits for the end of the transition before measuring
contrast. It does not vouch for compatibility with real screen readers or for WCAG compliance across
the whole app.
