# Browser Sentry

TravelPal is a static Next.js export served as an assets-only Worker. It uses
`@sentry/browser` 10.76.2, with no server SDK, route handlers, tunnel or
`withSentryConfig`. `SentryInit` initializes when the client module is evaluated, before
the first React render. `ErrorBoundary` and the global `error` and `unhandledrejection`
events share the same capture path. A `WeakMap` prevents sending the same error object
twice; the fallback shows its `event_id`, even with a custom fallback. With sending
disabled no made-up reference is shown. Distinct primitive errors have no object
identity to deduplicate on.

## Privacy

`sendDefaultPii: false`. There are no automatic integrations: no breadcrumbs, sessions,
replay, logs, metrics or fetch/XHR and performance instrumentation. The configured
sampling remains available for future explicit instrumentation; today
`beforeSendTransaction` drops every transaction.

`beforeSend` rebuilds the event from an allowlist: ID, date, platform, level, release,
environment, URL without query/fragment/credentials, exception type and stack locations
(file without query, function, line, column, `in_app`). The exception message is kept,
since it is what makes an issue readable, but it is sanitized in the browser: emails,
`Bearer`, `sk_`/`pk_`/`rk_` keys, `sntry…` tokens, JWTs and sequences of 9 or more digits
are replaced by `[email]`, `[token]` or `[num]`; whitespace is collapsed and the result
is trimmed to 200 characters. If sanitizing leaves it empty, `Exception details omitted`
is sent. Free-form event messages, stack variables, application context, extras,
breadcrumbs, headers (including Authorization/Cookie), bodies and user data are removed.
The only user sent is `anon-<UUID>`, generated in memory per page load: not an email, not
an InsForge ID and not a persistent identity. The route stays visible; do not add
private data to pathnames or to function/exception type names. Sentry also receives the
network metadata inherent to the HTTP transport; configure IP retention and filtering in
the owner's account.

The message is the only free text leaving the browser: if an error is written with user
data inside `Error(...)`, it will reach Sentry unless it matches the patterns above. Do
not put names, addresses or note content into error messages.

## Variables and CI

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Public browser DSN, set during build. Empty: does not initialize, install handlers or capture. GitHub repository variable `NEXT_PUBLIC_SENTRY_DSN` (not a secret). |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Optional; defaults to `production`. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional, between 0 and 0.05; defaults to 0.01. Does not enable automatic instrumentation. |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Computed by `next.config.js`: valid `GITHUB_SHA` or `git rev-parse HEAD`. Without Git metadata no release is declared. Do not introduce a made-up value. |
| `SENTRY_AUTH_TOKEN` | GitHub secret used only by the build/sourcemap steps. Never public, never in the Worker. Its absence skips sourcemap generation and upload. |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Optional GitHub variables to override the slugs; CI uses `pabloorgs` / `travelpal` by default. The upload script needs both values in its environment. |

Account and project already created and verified by the owner: organization
`pabloorgs`, region `de`, project `travelpal`, platform `javascript-nextjs`. Public DSN:

```text
https://bb04fb...9540@o4511064837062656.ingest.de.sentry.io/4512299836047440
```

The DSN is read from `process.env.NEXT_PUBLIC_SENTRY_DSN` during the build; CI takes it
from `vars.NEXT_PUBLIC_SENTRY_DSN`, already created by the owner. The only origin
allowed by the DSN validation and required by the CSP is
`https://o4511064837062656.ingest.de.sentry.io`. Wildcards are not allowed. The owner
must provision the CI secret `SENTRY_AUTH_TOKEN` with artifact upload permission (`org:ci`
per Sentry). This write token is different from the read token used for agents.

Only with `CI=true` and a token does Next generate browser sourcemaps. After the build,
CI runs `node scripts/sentry-sourcemaps.mjs`: without a token it reports and skips the
upload; with a token it requires org/project/SHA/sourcemaps and runs:

```bash
pnpm exec sentry-cli sourcemaps upload --release "$GITHUB_SHA" \
  --url-prefix '~/_next/static' --validate out/_next/static
```

The association uses release plus URL; no debug IDs are injected that would alter
hashed, immutable-cache assets. The script deletes every `.map` from `out/` in
`finally`, even if the upload fails. CI fails if the upload fails and does not deliver
that artifact. The validation and the artifact consumed by worker/e2e/deploy run after
that cleanup. No other publishing path is added. Outside CI no sourcemaps are generated.
When testing several builds, stop and restart `wrangler dev` after each build: the
watcher can temporarily keep the `_headers` template that Next copies before generating
the final hashes.

## CSP

`public/_headers` declares `https://o4511064837062656.ingest.de.sentry.io` exclusively
in `connect-src`. The generator keeps that source and adds the export's inline hashes.
The checker requires the exact host and rejects `*`, schemes such as `https:`/`wss:`,
`https://*` and any wildcard subdomain, including the generic and German Sentry
patterns. No additional inline code or remote scripts are allowed.

## Agent access: official read-only MCP

Official server: <https://mcp.sentry.dev/mcp>. The owner creates a personal Sentry token
with `org:read`, `project:read`, `team:read`, `event:read` and access to the required
project only. Never give an agent `event:write`, `project:write`, `org:write` or the CI
token. The token's account must also have limited access. The `skills=inspect` option
exposes inspection tools; the real restriction is enforced by the token scopes. Do not
enable `triage` or `project-management`.

The remote endpoint distinguishes `Sentry-Bearer` (explicit Sentry token) from `Bearer`
(MCP OAuth token), per the
[official toolkit](https://github.com/getsentry/toolkit#sentry-mcp). The owner provisions
the variables outside the repository and outside messages to agents. Do not copy a real
token into these examples or into Git.

Hermes, `~/.hermes/config.yaml`, `mcp_servers` section: this exact JSON object is also
valid YAML; merge the section with the existing connections:

```json
{
  "mcp_servers": {
    "sentry": {
      "url": "https://mcp.sentry.dev/mcp?skills=inspect",
      "headers": { "Authorization": "Sentry-Bearer ${SENTRY_ACCESS_TOKEN}" }
    }
  }
}
```

`SENTRY_ACCESS_TOKEN` holds the read token only. Hermes supports `${VAR}` interpolation
in headers:
[configuration reference](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md#environment-variable-references).

Codex, `~/.codex/config.toml`:

```toml
[mcp_servers.sentry]
url = "https://mcp.sentry.dev/mcp?skills=inspect"
env_http_headers = { Authorization = "SENTRY_MCP_AUTH" }
```

`SENTRY_MCP_AUTH` holds the full header `Sentry-Bearer <read-token>`; the
[official Codex documentation](https://developers.openai.com/codex/mcp) describes
`env_http_headers`. The URL is literal, with no slug interpolation. These fragments are
documentation: this change modifies neither `~/.hermes` nor `~/.codex`. The
authenticated connection remains pending until the owner provisions the token.

Example requests to the connected agent (replace real slugs/SHA/URL/UUID):

- "In travelpal, find unresolved issues from release `<real SHA>`; show ID, route and
  stack." Sentry filter: `is:unresolved release:<SHA>`.
- "Find errors whose events have URL `https://travelpal.prg-dev.workers.dev/trip` in the
  last 24 hours." Filter: `url:"https://travelpal.prg-dev.workers.dev/trip"`.
- "Find events from the anonymous user `anon-<UUID>` and group them by issue." Filter:
  `user.id:anon-<UUID>`. Do not search by email or InsForge ID: they are not sent.
- "Find the event with the visible reference `<event_id>` and show its release and
  stack." Query only; do not resolve, assign or comment on issues.

With `sentry-cli` installed in this repo (3.8.1), the owner can provision a read
`SENTRY_AUTH_TOKEN` for queries in their environment, plus `SENTRY_ORG` and
`SENTRY_PROJECT`, and run:

```bash
pnpm exec sentry-cli issues list --query 'is:unresolved release:<real-SHA>'
pnpm exec sentry-cli issues list --query 'url:"https://travelpal.prg-dev.workers.dev/trip"'
pnpm exec sentry-cli issues list --query 'user.id:anon-<UUID>'
```

The syntax was checked with `pnpm exec sentry-cli issues list --help`; remote queries
require the owner's account and token. Never use the upload token for these agent
queries.

## Implementation references

- Installed Next 16.3.8 docs: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, `environment-variables.md` and `01-app/03-api-reference/05-config/01-next-config-js/productionBrowserSourceMaps.md`.
- Installed README and declarations: `node_modules/@sentry/browser/README.md`, `build/npm/types/sdk.d.ts`, `build/npm/types/exports.d.ts`.
- [Exact browser SDK 10.76.2](https://github.com/getsentry/sentry-javascript/blob/10.76.2/packages/browser/src/sdk.ts): with no default integrations it installs no global handlers or BrowserSession either; here the handlers are our own.
- [JavaScript privacy/configuration](https://docs.sentry.io/platforms/javascript/configuration/options/), [Next SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/), [API permissions](https://docs.sentry.io/api/permissions/).
