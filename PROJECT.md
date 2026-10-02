# PROJECT.md — TravelPal

## Objetivo

TravelPal es una aplicación web para planificar, reservar y controlar viajes —itinerarios, gastos,
presupuestos y analíticas— construida en Next.js sobre Cloudflare Workers, con backend InsForge
(Postgres + Auth + Storage).

## Alcance

### Incluye

- **Cuenta**: registro, inicio de sesión, recuperación de contraseña, perfil y tema (auth por
  InsForge; el refresh token vive en cookie httpOnly).
- **Viajes** (`trips`) y su detalle.
- **Planificación**: reservas (`bookings`, incluido el vuelo como reserva manual de tipo `flight`) y
  actividades de itinerario (`itinerary_activities`).
- **Gastos** (`expenses`) y **presupuestos** (`budgets`).
- **Panel** (`/dashboard`) y **analíticas** (`/analytics`).
- **Diario de viaje** (`journal_entries`, con fotos privadas servidas por URL firmada).
- **Notas** (`notes`) y **tareas** (`tasks`).
- **Alertas** en la campana de notificaciones (derivadas de tareas, reservas y presupuestos; la
  campana lee y marca leído).
- **Landing** pública.
- **Push de navegador**: alta/baja de suscripción y service worker en el cliente.

### No incluye

- **Búsqueda de vuelos en vivo**: Amadeus se retiró; el vuelo se registra a mano (ADR-006).
- **Asistente/chatbot**: retirado por completo, junto con su proxy al LLM (ADR-008).
- **Envío de push de servidor**: bloqueado; solo existe la parte de cliente (ADR-013).
- **Vercel**: hosting retirado; el único camino es Cloudflare Workers (ADR-003).
- **Rework funcional** propuesto en `docs/audits/auditoria-utilidad-y-rework.md`: no aplicado.
- **Roadmap** (ver `README.md`): i18n, más APIs de viajes, colaboración y app móvil. Futuro, fuera
  del alcance actual.

## Definición de terminado

Un cambio está terminado cuando, sobre `main`:

- [ ] `npm run lint`, `npm run type-check`, `npm run test:ci` y `npm run build` pasan, y el CI
      (`.github/workflows/ci.yml`) queda en verde, incluido el job `worker-build`
      (`npx opennextjs-cloudflare build`).
- [ ] `node scripts/check-data-paths.mjs` pasa: no aparece ningún punto nuevo al BFF por `/api`
      (camino único de datos, ADR-009).
- [ ] El job `deploy` (push a `main`) publica el Worker con `npx opennextjs-cloudflare deploy`.
- [ ] El esquema desplegado en InsForge coincide con `migrations/` (todas las migraciones aplicadas).
- [ ] La funcionalidad funciona de extremo a extremo en producción y el aislamiento por usuario lo
      impone RLS (`auth.uid()`), no un handler.
- [ ] La documentación que se contradice con el código queda corregida o borrada (el código gana;
      regla de `CONTEXT.md`).
- [ ] Si la decisión cambia el alcance o el modelo de datos, lleva su ADR en `docs/DECISIONS/`.

## Referencias

- **Glosario y modelo de datos**: [`CONTEXT.md`](CONTEXT.md).
- **Decisiones (ADRs)**: [`docs/DECISIONS/`](docs/DECISIONS/) — 000 plantilla; 001 obsoleto; 002
  InsForge; 003 Cloudflare Workers; 004 esquema desde el modelo TS; 005 variables no inlineadas; 006
  vuelos a entrada manual; 007 rumbo visual «Cuaderno de viaje»; 008 retirada del asistente; 009
  camino único por el SDK; 010 persistencia por operación del planificador; 011 fotos del diario
  privadas; 012 retirada del código BFF y de `public.users`; 013 push de navegador solo cliente.
- **Issues y specs (tracker)**: GitHub issues de este repo, vía `gh` CLI
  ([`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)).
- **Arquitectura y guía técnica**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
  [`docs/TECHNICAL.md`](docs/TECHNICAL.md).
