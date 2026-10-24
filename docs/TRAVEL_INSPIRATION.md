# Operation: flight inspiration

The static page `/travel-inspiration` calls the InsForge function with the user
session. The `travel-inspiration` function verifies that session before calling the
Travelpayouts Data API. The application and the Cloudflare Worker do not receive the
Travelpayouts token.

## Current state and blockers

- No Travelpayouts account has been created and the InsForge function has not been
  deployed. No secrets have been configured and the real provider has never been
  called.
- Every test and verification of this change uses fabricated provider responses. They
  do not prove that the credential, the API or the links work with a real account.
- Approval of the project/program in Travelpayouts is external and still pending with
  the owner. Until the owner completes sign-up and gets approval, real calls, data
  availability checks and validation of any affiliate link use or attribution remain
  blocked.
- After external sign-up, the owner must also configure the secret and the flag in
  InsForge and deploy the function. Until then the interface cannot query real data.

## Sign-up and configuration in InsForge

Complete these steps only after the owner has created and approved the project/program
in Travelpayouts:

1. In the `travelpal` InsForge project, store `TRAVELPAYOUTS_API_TOKEN` as a function
   secret. Do not add it to GitHub Actions, `.env.local`, the code, the static bundle
   or the Cloudflare environment. Do not copy it into logs or screenshots.
2. In the function's InsForge environment configuration, set
   `TRAVELPAYOUTS_ENABLED=true`. This flag is not a secret. The value in GitHub Actions
   does not change the InsForge environment.
3. From the repo root, with Deno 2.9.7 and the correct InsForge project linked in the
   CLI, create the temporary Deno config and bundle the local dependencies into a
   single file. The SDK npm import stays external for Deno Subhosting:

   ```bash
   tmpdir="$(mktemp -d)"
   printf '%s\n' '{"imports":{"zod":"npm:zod@4.1.12"},"compilerOptions":{"lib":["deno.window","deno.ns","dom"],"strict":true}}' > "$tmpdir/deno.json"
   deno bundle --config "$tmpdir/deno.json" --no-lock --platform deno --packages bundle --output "$tmpdir/travel-inspiration.js" --external="npm:@insforge/sdk" insforge/functions/travel-inspiration/index.ts
   ```

4. Deploy the `travel-inspiration` slug with the bundled file:

   ```bash
   npx -y @insforge/cli functions deploy travel-inspiration --file "$tmpdir/travel-inspiration.js"
   ```

5. Confirm the state in the function list:

   ```bash
   npx -y @insforge/cli functions list
   ```

   Continue only if `travel-inspiration` appears with state `active`. A `draft` or
   `error` state requires resolving the deployment before enabling use.
6. When the deployment and the check are done, delete only the temporary directory
   created in step 3: `rm -rf "$tmpdir"`.

The secret must be loaded into the InsForge secret manager, not as a versioned
argument or a build variable. The CLI can also create secrets, but the value must
never be written in this document, in shared shell history or in command output.

## Manual authenticated check

Once the owner has completed sign-up, approval, configuration and deployment:

1. Sign in to TravelPal and open `/travel-inspiration` directly.
2. Confirm that the initial check shows the available state and that a valid query
   returns results or the expected empty state.
3. Open `Planear este viaje` and verify that `/create-trip` presents origin,
   destination and dates as editable values. Save only after pressing the form button
   explicitly.
4. If it fails, check the `active` state and the function configuration in InsForge.
   Do not print or copy the session bearer, the Travelpayouts secret or authorization
   headers into logs.

Prices are indicative and may be cached by the provider; they are not a live search
and do not guarantee availability. This manual check has not been run against real
Travelpayouts yet.

## Hosting

`/travel-inspiration` is exported as static HTML and the Cloudflare Worker remains
assets-only. No Next.js Route Handlers or application logic are added to the Worker.
The Cloudflare workflow does not deploy the function or configure its variables; those
operations belong to the InsForge project.
