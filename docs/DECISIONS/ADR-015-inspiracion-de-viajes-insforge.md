# ADR-015: Travel inspiration through an InsForge function

## Context

TravelPal is published as a static Next.js export served by a Cloudflare assets-only Worker. The
Worker runs no Next.js server and no Route Handlers. The user session is already available in the
browser through the InsForge SDK. Inspiration queries also need to protect the private Travelpayouts
credential and to validate the session before using it.

## Decision

- Publish `/travel-inspiration` as a static route and call the InsForge function
  `travel-inspiration` through `insforge.functions.invoke`.
- The function verifies the session bearer with InsForge and is the only piece that reads
  `TRAVELPAYOUTS_API_TOKEN`, stored as a function secret. `TRAVELPAYOUTS_ENABLED` is configured in
  that function's environment.
- Keep the Cloudflare Worker assets-only and the static export as the publication artifact. Do not add
  Next.js Route Handlers or an application server to the Worker.
- Bundle the function with Deno and deploy its slug through the InsForge CLI, separately from the
  site's publication workflow.
- Treat tests with mock responses as contract and behaviour verification, not as validation against
  the real provider. Project/program approval in Travelpayouts is external and remains pending with
  the owner.

## Consequences

- The Travelpayouts credential is not part of the client, the static export or the Worker
  configuration.
- The page can exist and pass local checks before the external sign-up; real calls stay blocked until
  the owner completes the sign-up and approval, configures the secret and the flag, and deploys the
  active function in InsForge.
- No Travelpayouts account has been created, no credentials configured and no function deployed.
  Therefore this ADR records the chosen architecture, not a verified integration with the provider.

## Status

Accepted as an architecture decision; operation against the provider is pending with the owner.
