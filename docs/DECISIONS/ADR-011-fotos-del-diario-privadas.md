# ADR-011: Fotos del diario en un bucket privado, con urls firmadas

## Contexto

Las fotos del diario viven en el bucket `journal-photos` de Storage y la tabla
`journal_photos` guarda dos cosas por cada foto: la `url` que devolvió el upload y la `key` del
objeto. El bucket era **público**, así que esa `url` era una capacidad de lectura permanente y sin
dueño: cualquiera que la tuviera —un enlace compartido, el historial del navegador, un log, una
captura de pantalla— veía la foto, con sesión o sin ella. El aislamiento por usuario existía en la
tabla (RLS `auth.uid() = user_id`, [ADR-002](ADR-002-insforge-backend.md)) pero no en el objeto: la
política protege qué filas se leen, no quién abre la imagen.

Las fotos de un viaje son contenido privado del usuario, así que el bucket pasa a privado y la
imagen se sirve **firmada**. Lo que verifiqué antes de escribir esto, contra un branch de InsForge
con el bucket ya privado ([#64]):

- `storage.from(bucket).upload(key, file)` sigue devolviendo `{ bucket, key, size, mimeType,
  uploadedAt, url }`. Esa `url` responde **401 sin firma**, pero sigue viniendo rellena y la columna
  es `not null`: **no hay migración de esquema**. Lo que autoriza la lectura del objeto es la `key`.
- `storage.from(bucket).createSignedUrl(key, ttl)` devuelve `{ signedUrl, expiresAt }` y la url
  firmada sirve **sin sesión**.
- `storage.from(bucket).createSignedUrls(paths[], ttl)` firma en lote y cada entrada trae
  `{ path, signedUrl, error }`: el fallo de una no tumba al resto.

## Decisión

1. **El bucket `journal-photos` es privado y las fotos se leen firmadas.** La visibilidad del bucket
   no la cambia la app: la aplica el CLI de InsForge. El código, en cambio, deja de pedir la `url`
   pública y pide firmas a partir de la `key`.
2. **La columna `url` deja de servir para pintar la imagen.** La lectura autorizada es la
   `signedUrl`, que se pide al cargar el listado con `createSignedUrls(keys, 3600)`: **una llamada en
   lote** para todas las filas y un **ttl de 3600 s** (`JOURNAL_PHOTOS_SIGNED_URL_TTL`). La columna
   `url` se sigue escribiendo tal cual la devuelve el upload, porque es `not null` y no hay motivo
   para migrar el esquema; queda como dato histórico, no como fuente de la imagen.
3. **El fallo de firma es por foto.** Cada entrada del lote trae su propio `error`, así que la foto
   sin firma se pinta como hueco («Foto del diario no disponible») con su botón de borrar intacto, y
   las demás se pintan con normalidad: una foto rota no tumba la lista. Si lo que falla es la llamada
   en bloque, la carga entera se trata como fallida con el patrón habitual del repo
   (`withQueryTimeout` + `queryErrorKind` + `getLoadErrorMessage`) y se puede reintentar: no se
   traga el error silenciosamente.
4. **La subida y el borrado no cambian.** El upload sigue persistiendo `url` y `key` (y sigue
   limpiando el objeto huérfano si falla el insert), y el borrado sigue usando la `key`, que es lo
   único que identifica el objeto con independencia de la visibilidad del bucket.
5. **`avatars` sigue público.** Es la cara del usuario y se pinta en contextos donde un enlace
   caducable complica el render sin aportar privacidad: no es contenido del viaje. Lo que este ADR
   cambia es el bucket de las fotos del diario, no el resto de Storage.

## La privacidad son las dos cosas juntas

Las urls firmadas en la app (punto 2) y las **politicas de propietario de `storage.objects`** ([#68])
son la misma decisión vista desde dos lados: la url firmada decide **qué se pide**, y la politica
decide **quién puede firmarlo**. Sin la segunda, el bucket privado no daba privacidad: `storage.objects`
estaba con RLS deshabilitada y cero politicas, así que en un bucket privado **cualquier usuario
autenticado listaba, firmaba y descargaba los objetos de otro** —dos usuarios reales, medido en
[#68]—. Firmar no es autorizar.

Las politicas viven en `migrations/20260917120000_storage-objects-owner-only.sql`: RLS habilitada en
`storage.objects`, el `drop policy if exists` antes de cada `create policy` (idempotente, como el resto
de migraciones) y las cuatro de propietario `to authenticated` —select, insert, update y delete— con
`uploaded_by = (select auth.jwt() ->> 'sub')`, más los grants de tabla y de esquema que el propietario
necesita. El dueño del objeto es `uploaded_by`, el `sub` del token, **no el prefijo de la `key`**: la
key lleva el id del usuario por convención, no es una frontera de seguridad.

**`avatars` sigue público a propósito**, como ya decía el punto 5: no hay contenido del viaje que
proteger ahí y multiplicaría las firmas en las vistas que pintan avatares. Estas politicas son
`to authenticated` y no añaden grant a `anon`: gobiernan el acceso autenticado a la tabla, mientras que
la visibilidad de un bucket se decide en el bucket.

## Consecuencias

- **Una llamada de red más por carga del listado**: el `select` de las filas y, después, la firma en
  lote de sus `key`. Es una sola petición extra, no una por foto, y va dentro del mismo
  `withQueryTimeout` que ya cortaba la lectura.
- **Las urls firmadas caducan.** A los 3600 s dejan de servir; la lista vuelve a firmar en cada
  carga, así que no hay estado que mantener ni caché que invalidar. Una pestaña abierta más tiempo
  que el ttl y sin recargar mostrará la imagen rota hasta que recargue, que es el
  comportamiento de aceptar el ttl como única frescura.
- **La autorización del objeto la impone el backend al firmar**: el SDK solo devuelve una firma a
  quien puede leer el objeto. La de la tabla la sigue imponiendo RLS. Son dos capas, no una.
- **Un dato muerto más explícito**: la `url` de cada fila ya no explica cómo se pinta la foto. Quien
  lea la tabla no debe asumir que esa columna sirve para abrir la imagen; el comentario del bucket en
  `src/lib/insforge.ts` y el tipo `JournalPhotoRow` (que añade `signedUrl`) lo dejan escrito.
- **Nada de endpoints nuevos**: la firma la pide el navegador con el SDK, en línea con el camino
  único del [ADR-009](ADR-009-camino-unico-sdk-en-navegador.md).

## Alternativas consideradas

- **Dejar el bucket público.** Descartada: es lo que el [#64] viene a corregir. El enlace no caduca y
  no tiene dueño, así que no hay forma de revocar el acceso a una foto ya vista.
- **Firmar desde un endpoint `/api` propio.** Descartada: reabre el BFF que el
  [ADR-009](ADR-009-camino-unico-sdk-en-navegador.md) cierra y paga la llamada extra de auth por
  petición. Es justo el camino que el guardián `scripts/check-data-paths.mjs` prohíbe.
- **`download()` del SDK (Blob y `objectURL`).** Descartada: baja cada foto a memoria y obliga a
  revocar los `objectURL` al desmontar. La url firmada la sirve el navegador como cualquier `img`,
  con su caché y sin gestión de memoria propia.
- **Firmar una a una con `createSignedUrl`.** Descartada: N peticiones donde el lote hace una. El ttl
  y la vida de cada firma son iguales.
- **Hacer privado también `avatars`.** Fuera de este cambio: no hay contenido privado que proteger
  ahí y multiplicaría las firmas en las vistas que pintan avatares.

## Estado

Aprobado

[#64]: https://github.com/PabloJustDevelops/TravelPal/issues/64
[#68]: https://github.com/PabloJustDevelops/TravelPal/issues/68
