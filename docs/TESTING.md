# Testing

| Nivel | Herramienta | Donde vive | Comando |
| --- | --- | --- | --- |
| Unidad y componente | Jest + Testing Library | `src/**/__tests__/` | `pnpm run test:ci` |
| End-to-end con datos | Playwright | `e2e/` | `pnpm run test:e2e` |
| Acceso público, escritorio y viewport estrecho | Tester Army (`e2e`) | `tests/*.e2e.ts` | `pnpm run test:tester` |

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
pnpm run test:e2e
```

Si prefieres no exportarlas en cada shell, dejarlas en `.env.local` (esta en
`.gitignore`): el runner lo carga. Las credenciales no se versionan nunca.

Playwright arranca el dev server por su cuenta (`webServer` con `pnpm run dev`) y
reutiliza el que ya tengas levantado en el 3000. Para ver los pasos en el
navegador, `pnpm exec playwright test --headed`; con `--debug`, paso a paso.

La suite va en dos proyectos: `smoke` en paralelo y `flows` con `workers: 1`. Los
flujos comparten el usuario dedicado y las mismas pantallas, asi que en
paralelo no se aislaban: se hacian la zancadilla y caia un spec distinto en cada
corrida local, siempre en el `toHaveURL` de `createTrip`.

## Las dos formas de la misma suite

El destino lo elige `E2E_BASE_URL`, y por defecto es localhost:

```bash
pnpm run test:e2e                      # codigo local (rama y PR)
E2E_BASE_URL=https://app-viajes.prg-dev.workers.dev pnpm run test:e2e   # lo desplegado
```

## Que cubre el smoke de la etapa 0

- `/signup`: formulario valido, envio y llegada al paso de verificacion con el
  email pendiente. El codigo no se completa (no hay buzon legible al que ir).
- `/signin` con el usuario dedicado: dashboard **con contenido** (titulo y
  navegacion reales), no solo la URL correcta.
- `/dashboard` sin sesion: acaba en `/signin`, sin bucle y sin pantalla vacia.
- `/signin` sin sesión: rellena el formulario con datos sintéticos usando el mismo
  helper que el login real, sin enviarlo. Comprueba mostrar y volver a ocultar la
  contraseña, sin confundir el input con el botón de visibilidad.

## Que cubre la etapa 1 (flujos con datos)

Cinco specs con seis casos en `e2e/flows/`, cada uno con su limpieza y una comprobacion de
accesibilidad con `@axe-core/playwright` (sin violaciones `critical` ni
`serious` en las pantallas donde se llama al helper de axe):

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

- `delete-trip.spec.ts`: borrar un viaje desde la UI y comprobar por separado que un gasto
  conservado queda sin viaje.

## Correr solo los flujos que crean datos

```bash
pnpm exec playwright test e2e/flows                 # local, contra el dev server
E2E_BASE_URL=https://app-viajes.prg-dev.workers.dev pnpm exec playwright test e2e/flows
```

El proyecto `flows` ya limita a un worker, asi que no hace falta pasar
`--workers=1` a mano.

## Borrado y limpieza de datos

La lista y el detalle permiten borrar viajes y decidir qué ocurre con sus gastos y notas.
El calendario normaliza las fechas de los viajes para mostrarlos en la rejilla. Estos fallos se
corrigieron en #81; no son limitaciones actuales.

Los E2E usan `e2e/support/cleanup.ts` como limpieza de seguridad, con la sesión del usuario
dedicado y RLS. Borra los datos y fotos que el propio test creó. Los casos de borrado prueban la
acción real de la UI; los demás no dependen de ella para limpiar tras un fallo.

## Datos de prueba y trazas

Los datos que crea un test llevan prefijo `e2e-` + marca de tiempo y se borran en
el propio test. Excepcion conocida: el caso de registro crea un usuario sin
verificar que no se puede borrar (InsForge no expone endpoint para eliminar
usuarios), asi que queda uno por corrida.

`trace: on-first-retry` y `retries: 2` en CI: la traza de un fallo queda en
`test-results/` y el job la sube como artefacto (`playwright-trace`).

Los casos de accesibilidad del dashboard y del detalle generan capturas en ambos
temas a 1440 y 390 px. El dashboard tiene una captura del estado de la cuenta y
otra con un viaje de QA, actividad, tarea y presupuesto con gasto. El escenario
poblado crea un viaje con la UI e inserta los datos auxiliares con el SDK bajo la
sesión E2E; al terminar, elimina la tarea, el presupuesto, el gasto, la actividad
y el viaje asociados a sus nombres únicos.

El job conserva las PNG de `/tmp/travelpal-atlas-*.png` y
`/tmp/travelpal-trip-*.png` durante 7 días como `atlas-qa-codigo` o
`atlas-qa-produccion`, también cuando la suite pasa. Las capturas sirven para
revisar el estado vacío y poblado de esa ejecución; no sustituyen una revisión
visual ni una comparación de fidelidad global.

## Tester Army

`pnpm run test:tester` ejecuta tres casos públicos en Chromium a 1440×900 y 390×844:
redirección de ruta protegida, opciones de acceso y recuperación de contraseña. No crea
usuarios, no envía correos y no necesita modelo ni suscripción. El viewport estrecho comprueba
layout responsive; no equivale a Safari/iOS ni a un dispositivo táctil real.

Ver [TESTER-ARMY.md](TESTER-ARMY.md) para configuración, límites y evolución.

## CI

El trabajo `e2e` de `.github/workflows/ci.yml` llama a la suite reutilizable
`.github/workflows/e2e.yml` tanto en PR como en push a `main`, contra el código local.
`deploy` espera a `build`, `worker` y `e2e`. Tras publicar, `e2e-produccion` ejecuta
las dos suites contra el Worker. CI fija Node 22.22.3.

Necesita `E2E_USER_EMAIL` y `E2E_USER_PASSWORD`; si faltan, el job falla antes de que el
login pueda omitirse. El job completo se serializa entre ramas porque comparte usuario y
backend. Los pushes nuevos de un PR cancelan su CI anterior; un deploy de `main` no se cancela.

Los artefactos de fallo de Playwright y el informe de Tester Army se conservan siete días.
La telemetría de Tester Army está desactivada. No hay pasos con modelos en el gate.

## Cobertura pendiente

No existe aún cobertura completa de móvil real, WebKit/Firefox, OAuth de Google con proveedor
real, verificación de email completa, CRUD completo de tareas/notas, perfil/ajustes ni regresión visual.
Jest prueba la capa cliente de push; no demuestra entrega real de avisos. Los asserts de axe
existentes tampoco constituyen una auditoría completa de accesibilidad.

## Componentes y accesibilidad aislada

`pnpm run storybook` abre el catálogo en localhost:6006 con controles y formularios reales,
datos sintéticos y selector de tema. `pnpm run build-storybook` genera el catálogo estático
local (ignorado por Git; no se publica con el Worker).

`pnpm run test:storybook` usa Vitest exclusivamente para las stories, en Chromium real.
Jest conserva las pruebas de unidad y aplicación. El addon de accesibilidad tiene
`a11y.test: error`: sus violaciones fallan el test. La CI construye el catálogo y ejecuta
estas pruebas después de instalar Chromium.

`e2e/flows/forms-accessibility.spec.ts` verifica Tareas y Notas en claro/oscuro a 390 y
1440 px: etiquetas, error de título, radios con teclado, axe completo dentro del diálogo,
cierre y restauración del foco. No guarda tareas ni notas. Espera al final de la transición
antes de medir contraste. No acredita compatibilidad con lectores de pantalla reales ni
un cumplimiento WCAG de toda la app.
