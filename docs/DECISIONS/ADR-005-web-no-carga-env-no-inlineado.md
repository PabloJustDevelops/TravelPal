# ADR-005: The site failed to load because of non-inlined public variables, not compression

## Context

The site stopped loading in any browser (browser error page, with Next's `__next_error__` page
underneath), while `curl` received 200 with the correct HTML. The initial investigation attributed
the failure to compression: requesting with a browser header (`Accept-Encoding: gzip, deflate,
br, zstd`) returned `Content-Encoding: zstd`. Two "fixes" came out of that: `compress: false` in
`next.config.js` (`ba609f4`) and a `Cache-Control: no-transform` written from `src/proxy.ts`.

## Decision

The diagnosis was wrong. Both changes are discarded and the reason is documented:

- The zstd served by the edge is valid: 8667 B decode exactly to the same 37456 B of the
  uncompressed HTML (byte-by-byte comparison, Node zlib).
- Serving every response uncompressed (a local reverse proxy stripping `Accept-Encoding` from each
  request, rewriting the origin), the browser fails exactly the same way, with the same exception.
- With `compress: false` already deployed, the edge still sends zstd: Next's `compress` option only
  affects the Node server, not the Cloudflare Worker.

The real cause was different: `src/lib/public-env.ts` validated the whole `process.env` object. The
bundler only substitutes static accesses (`process.env.NEXT_PUBLIC_X`); the whole object arrives as
`{}` in the browser, the zod validation threw during module evaluation and took down every module
importing `publicEnv` (InsForge client, logger, auth). It is fixed by enumerating each public
variable with a static access.

`no-transform` does stop Cloudflare from compressing (verified on a preview version: the response
loses `Content-Encoding`), but it is unnecessary for this failure, it disables HTML compression and
it overrides the route's `Cache-Control: s-maxage`. It is not used.

## Consequences

- Edge compression stays on (zstd/brotli/gzip depending on `Accept-Encoding`); it is correct and it
  does not stop the browser from rendering.
- When the symptom is "the site does not load in the browser but `curl` gets 200", suspect the
  client bundle first (exceptions while evaluating modules) and not compression: `curl` does not
  execute JavaScript, a browser does.
- `compress: false` does nothing in the Worker; do not propose it again as a hosting fix.
- When reading `NEXT_PUBLIC_*` variables in code that runs in the client, always use static access;
  never pass `process.env` as an object.

## Status

Accepted
