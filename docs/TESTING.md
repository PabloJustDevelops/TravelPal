# Testing

| Nivel | Herramienta | Donde vive | Comando |
| --- | --- | --- | --- |
| Unidad y componente | Jest + Testing Library | `src/**/__tests__/` | `npm run test:ci` |
| End-to-end (navegador) | Playwright | `e2e/` | `npm run test:e2e` |

## Regla: ningun bug entra sin el test que falla sin el arreglo

Todo bug arreglado entra con la prueba que se pone en rojo con el codigo anterior
y en verde con el arreglo. La red tiene que fallar antes: un test que no puede
fallar no vale. Los tres fallos que pasaron lint, type-check, build y los 290
tests unitarios en verde (el registro que no persistia, el dashboard en blanco
tras iniciar sesion y la ruta protegida rebotando) no eran detectables con tests
unitarios, y cada uno entro con su caso en `e2e/smoke/`.

## E2E en local

Hacen falta las credenciales del usuario dedicado de e2e (esta verificado en
produccion; la suite nunca crea usuarios):

```bash
export E2E_USER_EMAIL=<email del usuario dedicado>
export E2E_USER_PASSWORD=<su contrasena>
npm run test:e2e
```

Si prefieres no exportarlas en cada shell, dejarlas en `.env.local` (esta en
`.gitignore`): el runner lo carga. Las credenciales no se versionan nunca.

Playwright arranca el dev server por su cuenta (`webServer` con `npm run dev`) y
reutiliza el que ya tengas levantado en el 3000. Para ver los pasos en el
navegador, `npx playwright test --headed`; con `--debug`, paso a paso.

## Las dos formas de la misma suite

El destino lo elige `E2E_BASE_URL`, y por defecto es localhost:

```bash
npm run test:e2e                      # codigo local (rama y PR)
E2E_BASE_URL=https://app-viajes.prg-dev.workers.dev npm run test:e2e   # lo desplegado
```

## Que cubre el smoke de la etapa 0

- `/signup`: formulario valido, envio y llegada al paso de verificacion con el
  email pendiente. El codigo no se completa (no hay buzon legible al que ir).
- `/signin` con el usuario dedicado: dashboard **con contenido** (titulo y
  navegacion reales), no solo la URL correcta.
- `/dashboard` sin sesion: acaba en `/signin`, sin bucle y sin pantalla vacia.

## Que cubre la etapa 1 (flujos con datos)

Cuatro flujos en `e2e/flows/`, cada uno con su limpieza y una comprobacion de
accesibilidad con `@axe-core/playwright` (sin violaciones `critical` ni
`serious` en la pantalla que toca el flujo):

- `trips.spec.ts`: crear un viaje en `/trips/new`, verlo en el detalle y en la
  lista, buscandolo por su titulo. Axe en la lista de viajes.
- `expenses.spec.ts`: con un viaje recien creado, registrar un gasto asociado,
  verlo en `/expenses` y comprobar que suma en el resumen del viaje. Axe en la
  lista de gastos.
- `planning.spec.ts`: anadir una actividad en el planificador y comprobar que
  sigue ahi tras recargar (la persistencia por operacion del #60, sin boton de
  guardar). Axe en el planificador.
- `journal-photos.spec.ts`: subir una foto al diario de un viaje pasado y
  comprobar que se pinta con URL firmada; el hueco `role="img"` del fallback no
  cuenta como exito. Axe en el detalle del viaje.

Los helpers compartidos viven en `e2e/support/`: `flows.ts` (login, alta del
viaje, comprobacion de axe) y `cleanup.ts` (borrado del viaje).

## Correr solo los flujos que crean datos

```bash
npx playwright test e2e/flows                 # local, contra el dev server
E2E_BASE_URL=https://app-viajes.prg-dev.workers.dev npx playwright test e2e/flows --workers=1
```

## Limitaciones conocidas: un viaje no se puede borrar desde la UI

La limpieza de los flujos va por el SDK (`e2e/support/cleanup.ts`) porque la app
no ofrece ninguna ruta que borre un viaje:

- `/trips` solo tiene "Editar": no hay borrado ni en la lista ni en el detalle.
- El menu contextual del calendario de `/planning` si sabe borrar un viaje
  (`handleDeleteEvent`), pero **nunca pinta los eventos de tipo `trip`**:
  `generateCalendarEvents` guarda en `date` el `departure_date` tal cual, que es
  `timestamptz`, y `getEventsForDay` compara contra `'yyyy-MM-dd'`. Los viajes se
  cuentan en "Eventos Este Mes" pero no aparecen en la rejilla, asi que la accion
  de borrar no es alcanzable.

La limpieza por SDK entra con la sesion del usuario dedicado (RLS sigue mandando),
vacia el objeto del bucket `journal-photos` y borra las filas hijas antes que el
viaje (`expenses` es `on delete set null` y quedaria suelta). Los dos fallos de
arriba van a issue aparte; no se arreglan en este PR.

## Datos de prueba y trazas

Los datos que crea un test llevan prefijo `e2e-` + marca de tiempo y se borran en
el propio test. Excepcion conocida: el caso de registro crea un usuario sin
verificar que no se puede borrar (InsForge no expone endpoint para eliminar
usuarios), asi que queda uno por corrida.

`trace: on-first-retry` y `retries: 2` en CI: la traza de un fallo queda en
`test-results/` y el job la sube como artefacto (`playwright-trace`).

## CI

El trabajo `e2e` de `.github/workflows/ci.yml` llama dos veces a la suite
reutilizable `.github/workflows/e2e.yml`: en el PR despues de `build`, y tras el
`deploy` de `main` contra produccion. Necesita dos secrets del repositorio,
`E2E_USER_EMAIL` y `E2E_USER_PASSWORD`; si faltan, el job falla en vez de pasar en
verde con el caso de login omitido.
