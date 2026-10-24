# ADR-011: Journal photos in a private bucket, with signed URLs

## Context

Journal photos live in the `journal-photos` Storage bucket and the `journal_photos` table stores two
things per photo: the `url` the upload returned and the object's `key`. The bucket was public, so
that `url` was a permanent read capability with no owner: anyone holding it (a shared link, browser
history, a log, a screenshot) saw the photo, with or without a session. Per-user isolation existed in
the table (RLS `auth.uid() = user_id`, [ADR-002](ADR-002-insforge-backend.md)) but not on the object:
the policy protects which rows are read, not who opens the image.

A trip's photos are the user's private content, so the bucket becomes private and the image is served
signed. What I verified before writing this, against an InsForge branch with the bucket already
private ([#64]):

- `storage.from(bucket).upload(key, file)` still returns `{ bucket, key, size, mimeType,
  uploadedAt, url }`. That `url` answers 401 without a signature, but it still comes back filled and
  the column is `not null`: there is no schema migration. What authorises reading the object is the
  `key`.
- `storage.from(bucket).createSignedUrl(key, ttl)` returns `{ signedUrl, expiresAt }` and the signed
  url is served without a session.
- `storage.from(bucket).createSignedUrls(paths[], ttl)` signs in batch and each entry carries
  `{ path, signedUrl, error }`: one failure does not take down the rest.

## Decision

1. The `journal-photos` bucket is private and photos are read signed. The bucket's visibility is not
   changed by the app: the InsForge CLI applies it. The code, instead, stops asking for the public
   `url` and asks for signatures from the `key`.
2. The `url` column stops being used to render the image. The authorised read is the `signedUrl`,
   requested when loading the listing with `createSignedUrls(keys, 3600)`: one batch call for all
   rows and a ttl of 3600 s (`JOURNAL_PHOTOS_SIGNED_URL_TTL`). The `url` column is still written as
   the upload returns it, because it is `not null` and there is no reason to migrate the schema; it
   remains historical data, not the source of the image.
3. Signature failure is per photo. Each entry in the batch carries its own `error`, so a photo without
   a signature renders as a gap ("Foto del diario no disponible") with its delete button intact, and
   the others render normally: one broken photo does not take down the list. If the batch call itself
   fails, the whole load is treated as failed with the repo's usual pattern (`withQueryTimeout` +
   `queryErrorKind` + `getLoadErrorMessage`) and can be retried: the error is not swallowed silently.
4. Upload and delete do not change. The upload still persists `url` and `key` (and still cleans up the
   orphaned object if the insert fails), and delete still uses the `key`, which is the only thing that
   identifies the object regardless of the bucket's visibility.
5. `avatars` stays public. It is the user's face and it is rendered in contexts where an expiring link
   complicates the render without adding privacy: it is not trip content. What this ADR changes is the
   journal photos bucket, not the rest of Storage.

## Privacy is both halves together

The signed urls in the app (point 2) and the owner policies on `storage.objects` ([#68]) are the same
decision seen from two sides: the signed url decides what is requested, and the policy decides who can
sign it. Without the second, the private bucket gave no privacy: `storage.objects` had RLS disabled
and zero policies, so in a private bucket any authenticated user could list, sign and download another
user's objects (two real users, measured in [#68]). Signing is not authorising.

The policies live in `migrations/20260917120000_storage-objects-owner-only.sql`: RLS enabled on
`storage.objects`, `drop policy if exists` before each `create policy` (idempotent, like the rest of
the migrations) and the four owner policies `to authenticated` (select, insert, update and delete)
with `uploaded_by = (select auth.jwt() ->> 'sub')`, plus the table and schema grants the owner needs.
The object's owner is `uploaded_by`, the token's `sub`, not the `key` prefix: the key carries the user
id by convention, it is not a security boundary.

`avatars` stays public on purpose, as point 5 already said: there is no trip content to protect there
and it would multiply signatures in the views that render avatars. These policies are
`to authenticated` and add no grant to `anon`: they govern authenticated access to the table, while a
bucket's visibility is decided on the bucket.

## Consequences

- One more network call per listing load: the `select` of the rows and then the batch signature of
  their `key`s. It is a single extra request, not one per photo, and it runs inside the same
  `withQueryTimeout` that already bounded the read.
- Signed urls expire. After 3600 s they stop being served; the list signs again on each load, so there
  is no state to maintain and no cache to invalidate. A tab open longer than the ttl without reloading
  will show a broken image until it reloads, which is the behaviour of accepting the ttl as the only
  freshness.
- Object authorisation is enforced by the backend when signing: the SDK only returns a signature to
  someone who can read the object. Table authorisation is still enforced by RLS. Two layers, not one.
- One more explicit dead value: each row's `url` no longer explains how the photo is rendered. Whoever
  reads the table should not assume that column opens the image; the bucket comment in
  `src/lib/insforge.ts` and the `JournalPhotoRow` type (which adds `signedUrl`) write it down.
- No new endpoints: the browser requests the signature with the SDK, in line with the single path of
  [ADR-009](ADR-009-camino-unico-sdk-en-navegador.md).

## Alternatives considered

- Leaving the bucket public. Discarded: it is what [#64] corrects. The link does not expire and has no
  owner, so there is no way to revoke access to a photo already seen.
- Signing from an `/api` endpoint of our own. Discarded: it reopens the BFF that
  [ADR-009](ADR-009-camino-unico-sdk-en-navegador.md) closes and pays the extra auth call per request.
  It is exactly the path the `scripts/check-data-paths.mjs` guard forbids.
- The SDK's `download()` (Blob and `objectURL`). Discarded: it downloads each photo into memory and
  forces revoking the `objectURL`s on unmount. The signed url is served by the browser like any `img`,
  with its cache and no memory management of our own.
- Signing one by one with `createSignedUrl`. Discarded: N requests where the batch does one. The ttl
  and the life of each signature are the same.
- Making `avatars` private too. Out of this change: there is no private content to protect there and it
  would multiply signatures in the views that render avatars.

## Status

Accepted

[#64]: https://github.com/PabloJustDevelops/TravelPal/issues/64
[#68]: https://github.com/PabloJustDevelops/TravelPal/issues/68
