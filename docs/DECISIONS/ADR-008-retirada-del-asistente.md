# ADR-008: The assistant is retired, and with it the proxy to the LLM

## Context

The app carried an assistant (chatbot) mounted on every private page from
`src/components/layout/DashboardLayout.tsx`. The pieces were:

- Interface under `src/components/chatbot/`: the floating button (`ChatbotButton`), the window
  (`ChatbotWindow`), the writing field (`ChatbotInput`) and the message bubble (`ChatbotMessage`),
  plus the window's test.
- Server proxy `src/app/api/chat/route.ts`: a route handler that required a session
  (`requireUser()`), validated the body and forwarded the messages to the LLM.
- LLM client `src/lib/llmService.ts`: it called the OpenRouter API
  (`https://openrouter.ai/api/v1/chat/completions`) with the `OPENROUTER_API_KEY` key (with
  `GROQ_API_KEY` as a fallback key) and a configurable model
  (`OPENROUTER_MODEL` / `NEXT_PUBLIC_LLM_MODEL`).

Two facts end its life:

- There is no budget for an LLM behind it. The assistant is only useful if something answers on the
  other side; sustaining a paid provider (or a free account with a quota) is not in the plan.
- It was the only surface holding a server secret. The server dependency audit already pointed it
  out: of the handlers that survived, `chat` was the only one keeping a secret (the LLM key).
  Retiring it reduces surface directly: one credential fewer to rotate and one door fewer through
  which something can escape.

The [utility inventory](../audits/auditoria-utilidad-y-rework.md) labelled it "useful but
secondary" and already warned that "its cost is not only UI": that cost is exactly what stops paying
for itself here.

## Decision

The assistant is retired entirely:

1. Deleted: the interface (`src/components/chatbot/*`, including its test), the endpoint
   `src/app/api/chat/route.ts` (and its folder) and the client `src/lib/llmService.ts` (with its
   test).
2. Disconnected from the shell: `DashboardLayout.tsx` stops importing and mounting
   `ChatbotButton`/`ChatbotWindow` and loses its state.
3. The environment variables left orphaned are cleaned up: `OPENROUTER_API_KEY`, `GROQ_API_KEY` and
   `OPENROUTER_MODEL` from `src/lib/env.ts`; `NEXT_PUBLIC_LLM_*` from `src/lib/public-env.ts`,
   `next.config.js` and `.env.example`; and the asserts that cited them in
   `src/lib/__tests__/env.test.ts`. The server keys are revoked separately (see Consequences).
4. The design guard is updated: `ChatbotWindow.tsx` leaves the list of native buttons
   (`src/__tests__/design-system.test.ts`).

### How the assistant would come back

If there is a budget some day, there are two paths:

- Path A: restore from git history. Locate the commit that applies this ADR and recover the files
  from the previous commit:

  ```
  git log --diff-filter=D --oneline -- src/lib/llmService.ts src/app/api/chat/route.ts
  git checkout <commit>^ -- src/components/chatbot/ src/lib/llmService.ts \
    src/app/api/chat/route.ts src/lib/__tests__/llmService.test.ts
  ```

  Then: mount `ChatbotButton`/`ChatbotWindow` in `DashboardLayout.tsx` again, restore the environment
  variables in `env.ts`/`public-env.ts`/`next.config.js`/`.env.example` and add `ChatbotWindow.tsx`
  back to the guard if it uses a native `<button>` again.

- Path B: reimplement on InsForge's AI gateway. If InsForge exposes an AI gateway for the project,
  the model call can live behind the existing backend and reuse `INSFORGE_API_KEY` (which is still in
  the repo and the backend), without adding a new provider credential. The endpoint (or an edge
  function) and the interface would have to be rebuilt.

Secrets that would be needed and where they would live:

- Path A (OpenRouter/Groq): `OPENROUTER_API_KEY` on the server only, with no `NEXT_PUBLIC_` prefix,
  declared as a Worker secret (`wrangler secret put`) and in `.dev.vars` for local development;
  optional `GROQ_API_KEY` and `OPENROUTER_MODEL`. Never in the client bundle.
- Path B (InsForge gateway): none new; `INSFORGE_API_KEY` is reused, and it already lives as a
  server secret in the repo and the backend.

What would have to be rebuilt in the interface: the four components in `src/components/chatbot/`,
their mounting and state in `DashboardLayout.tsx`, and, if it reappears, its entry in the design
guard's list of native buttons.

### Alternatives considered

- Keeping the assistant and touching nothing. Discarded: the cost (endpoint, secret to rotate,
  dependency and UI maintenance) keeps running with no budget to justify it.
- Leaving the endpoint without an interface (in case it is reused). Discarded: it keeps a proxy to a
  paid LLM exposed and a live secret in exchange for nothing. The half that is dropped is the
  cheapest to recover (it is in git).
- Passing the key to the client with a `NEXT_PUBLIC_` prefix so the browser calls the LLM. Discarded
  outright: it would publish the secret, which is exactly the surface this ADR removes.
- Hardening the endpoint (rate limit, per-user quota) instead of retiring it. Discarded: there is
  still a paid LLM behind it, which is the underlying problem.
- Replacing it with InsForge's AI gateway. That is a good reincarnation when there is a budget, not
  an alternative to retiring it today. It remains as path B above.

## Consequences

- The assistant is lost: a real feature, accepted. There is no product analytics today measuring its
  use, so the loss is one of surface, not of a metric.
- The only proxy with a server secret goes away. `OPENROUTER_API_KEY` (and `GROQ_API_KEY`) are no
  longer needed: they are revoked at the provider and deleted from the backend/Cloudflare secrets.
  This reduces surface directly and is the security reason for the decision.
- Less maintenance: one endpoint, one client, four components and two test files fewer; and one
  network and quota dependency fewer to watch.
- Dependency debt: `react-markdown` and `remark-gfm` are left unused in the code. They are
  candidates for cleanup in a separate task; `package.json` is not touched here.
- Historical documents: a note is added at the end of
  [`docs/audits/auditoria-utilidad-y-rework.md`](../audits/auditoria-utilidad-y-rework.md) and the
  sentence in [ADR-006](ADR-006-vuelos-de-amadeus-a-entrada-manual.md) that counted `chat` as a
  survivor is corrected. The rest of the audits are left as history.

## Status

Accepted
