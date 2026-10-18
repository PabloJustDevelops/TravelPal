# Interior Atlas — plan de implementación

> Ejecución secuencial con superpowers:executing-plans. Un propietario de escritura cada vez; revisión independiente al final. Sin commit, push ni deploy.

> **Nota (2026-10-18).** Este plan describe la implementación que vivió en la rama
> `codex/auth-brand-a11y`, retirada sin fusionar: su base (`c0ef4bd`) quedó 80 commits por
> detrás de `main`, es anterior a la migración a export estático y a la migración de la
> autenticación al SDK, y varios de sus componentes importan `@/lib/insforge/auth-actions`,
> módulo que `main` ya no tiene. Se conservan aquí las diez maquetas aprobadas y este plan
> como referencia de diseño; una implementación futura debe hacerse por etapas sobre `main`
> actual y volver a verificar cada una.

**Objetivo:** trasladar las diez maquetas aprobadas a los flujos reales de TravelPal, conservando contratos, sesión y capacidades existentes.
**Arquitectura:** shell y tokens privados compartidos, componentes de cada módulo sobre servicios existentes. Sin nuevas bibliotecas UI ni migraciones. Los datos e imágenes de destinos provienen del usuario; fixtures únicamente locales.
**Stack:** Next 16.3.8, React 19, Tailwind 4, Heroicons, Headless UI, react-calendar y componentes locales.
**Spec:** `docs/design/proposals/interior-atlas-2026-10-16/README.md`, sus diez PNG, `DESIGN.md` y ADR-008-atlas-claro.

## Restricciones globales

- Worktree `/home/pablorg/.codex/worktrees/auth-brand-a11y/travelpal`, rama `codex/auth-brand-a11y`, base `c0ef4bd65c5a62eedd41a90626a8a2b7963a714f`.
- Conservar WIP auth inicial (snapshot local `/tmp/travelpal-interior-initial-wip.patch`). No escribir auth ni landing.
- Inter, navy/papel/azul, superficies abiertas, sidebar normalizada 240 px; títulos privados 24–40 px según viewport. No repetir fecha actual.
- Desktop 1440 y móvil 390, claro/oscuro, foco visible, controles ≥44 px, reduced motion. No entradas decorativas de tarjetas.
- `/budget → /expenses`; `/analytics` y `/alerts → /dashboard`. Sin backend cloud ni demos de producción.

## Foco de revisión

1. Monedas distintas, presupuestos superpuestos, periodos y filtros: ningún total mezcla monedas ni duplica el mismo resumen.
2. Viaje actual/próximo, sin regreso y fechas locales: orden y selección correctos.
3. Notas pendientes: cambiar selección, cerrar o navegar conserva protección; guardado fallido conserva borrador.
4. Tareas y agenda largas: alternativa al arrastre, contenido móvil sin recortes y estados persistidos.
5. Errores y vacíos de consultas, teclado y modo oscuro: acciones comprensibles y accesibles, auth intacta.

## Checklist y ownership

| Etapa | Propietario de escritura | Ficheros / responsabilidad | Estado |
|---|---|---|---|
| 1 | principal | `layout/{DashboardLayout,Navbar}`, `ui/PageTitle`, `dashboard/page`, `dashboard/NextTrip` y estilos privados | Completada |
| 2 | trips_interior, secuencial | `app/trips`, `components/trips`: lista, alta, detalle/diario | Completada |
| 3 | principal | `app/planning`, `components/planning`, calendario: tres modos y reordenado | Completada |
| 4 | principal | `app/tasks`, `components/tasks`: lista por estado + tablero/calendario | Completada |
| 5 | principal | `app/expenses`, `components/expenses`: movimientos, presupuestos y formularios | Completada |
| 6 | principal | `app/notes`, `components/notes`: dos paneles, favoritos y borradores | Completada |
| 7 | principal | `app/profile`, `app/settings`: formularios abiertos y preferencias | Completada |
| 8 | principal + reviewer read-only | pruebas, capturas y comparación, QA, DESIGN | Completada |

Cada etapa: leer componentes/call sites/tests → prueba de comportamiento nueva cuando cambie interacción → implementar → tests dirigidos → registrar evidencia. Después ejecutar lint, TypeScript, Jest completo y build OpenNext. QA con Playwright/axe sobre backend local aislado: vacío y poblado, 1440/390, claro/oscuro; CRUD e interacciones principales. Revisión read-only independiente antes de declarar cierre.

## Mapa de dependencias

- `DashboardLayout → ProtectedRoute + Navbar`; páginas consumen `AuthContext`. Root monta tema/toasts/movimiento. PageTitle conserva props.
- Dashboard consulta trips/expenses/budgets/tasks, después actividades del próximo viaje; NextTrip selecciona viaje y calcula presupuesto por moneda/periodo/categoría. Export JSON/PDF en dashboard.
- Viajes lista/alta/detalle usan `lib/trips`, diario y fotos privados. Viajeros se guarda en notes; presupuesto inicial EUR existente.
- Planning contiene Calendar, ItineraryPlanner y NewBookingForm; `order_index` ya forma parte del modelo. Mantener las tres vistas.
- Tasks mantiene update optimista con rollback, TaskBoard y calendario; añadir lista como vista inicial.
- Expenses calcula presupuesto por periodo/categoría/viaje/moneda; formularios mapean descripción a title y notas a description.
- Notes usa NoteEditor y CRUD; `is_favorite` existe. Añadir control de borrador y selección sin cambiar esquema.
- Profile usa updateProfile/uploadAvatar; Settings ThemeContext, usePushNotifications y resetPassword.

## Evidencia inicial

- `git status --short`, `git diff --stat`, `git rev-parse HEAD`: WIP solo auth/assets/docs; HEAD arriba. Código 0.
- `pnpm run type-check`: `$ tsc --noEmit`; código 0.
- `pnpm exec jest --runInBand --coverage=false`: 64 suites, 464 tests pasados; código 0.
- `pnpm run lint`: 13 warnings, 0 errores; código 0.
- `curl` local: app HTTP307, backend HTTP302; navegador integrado muestra dashboard autenticado vacío.

## Reanudación · 17 de octubre

El reinicio borró los scripts y capturas de `/tmp`, incluido el snapshot inicial de WIP; los cambios del worktree y los volúmenes de Docker permanecieron. Se restauraron los bind mounts públicos del backend aislado, sin regenerar claves ni modificar datos cloud. La evidencia se vuelve a generar y se conserva en `docs/qa/audits/2026-10-16-interior-atlas/`.

La revisión independiente encontró y verificó correcciones de borradores de notas, viaje contextual de reservas y escrituras limitadas al orden de actividades. Una revisión posterior del perfil y enlaces de cancelar no encontró hallazgos. El reordenado sigue siendo compensatorio, sin transacción de servidor.

## Cierre verificado · 17 de octubre

TypeScript sin errores; lint 0 errores/13 avisos; Jest 67 suites/477 tests; Playwright 25 tests; timezone 8 tests; build OpenNext en Node 22.22.3. Todos con código 0. Matrices vacío/poblado y estados: 96 vistas, 0 incidencias de axe/desbordamiento. 108 artefactos visuales (96 capturas y 12 comparaciones/hojas) conservados con SHA-256. Comandos, salidas, límites y revisión independiente en [informe QA](../qa/audits/2026-10-16-interior-atlas/design-qa.md). Rama/worktree conservados sin commit, push ni deploy.
