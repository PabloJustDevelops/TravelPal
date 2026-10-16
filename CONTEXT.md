# Context

## What this is

TravelPal (repo "app-viajes"): app web para planificar viajes — itinerarios, gastos,
presupuestos, notas, tareas, reservas, alertas y analíticas.

## Stack

- **Framework**: Next.js 16.3.8 (App Router) + React 19 + TypeScript.
- **Backend**: InsForge (Postgres + Auth + Storage) con `@insforge/sdk` desde el navegador.
- **Hosting**: export estático de Next.js (`out/`) servido por Cloudflare Workers Assets con Wrangler
  (ver ADR-014; ADR-003 describe la etapa anterior con OpenNext).
- **Tests**: Jest + Testing Library. **Lint**: ESLint. **Commits**: Conventional Commits.

## Commands

```bash
pnpm run dev          # Next dev
pnpm run lint         # ESLint
pnpm run type-check   # tsc --noEmit
pnpm run test:ci      # Jest (CI)
pnpm run test:e2e     # Playwright E2E (ver docs/TESTING.md)
pnpm run build        # next build genera el export estático en out/
pnpm run preview      # wrangler dev; sirve el out/ ya generado
pnpm run deploy       # rebuild, valida el export y lo publica con Wrangler
```

## Data model — single source of truth

`migrations/20260913181842_create-app-schema.sql`. No hay otro SQL: el resto se borro por
contradecirse (ver ADR-004). La migracion base tambien se limpio al retirar `reminders` y
`calendar_events`, tablas que nunca existieron en el backend (ver
`docs/audits/auditoria-utilidad-y-rework.md`). El esquema se deriva de las consultas reales; si el
modelo TypeScript cambia, la migracion debe actualizarse.

Tablas: `trips`, `expenses`, `notes`, `tasks`, `bookings`, `itinerary_activities`,
`alerts`, `budgets`, `journal_entries`, `profiles`.

Reglas: `text + CHECK` en vez de enums; FKs solo si una consulta las usa; RLS de propietario con
`auth.uid()` en cada tabla con `user_id` (y por `id` en `profiles`).

## Glossary

- **Trip**: viaje del usuario (origen, destino, fechas, estado).
- **Expense**: gasto, opcionalmente ligado a un Trip.
- **Budget**: presupuesto por Trip o general, con `total_amount` y `spent_amount`.
- **Booking**: reserva de un Trip (vuelo, hotel, coche, actividad, restaurante, otro).
- **ItineraryActivity**: actividad con fecha dentro de un Trip.
- **Note**: nota del usuario, opcionalmente ligada a un Trip.
- **JournalEntry**: entrada del diario de un Trip (fecha, texto libre y valoracion de 1 a 5). Es
  la memoria post-viaje; distinta de una Note, que es global.
- **Task**: tarea con estado y prioridad.
- **Alert**: aviso mostrado en la campana de notificaciones.
- **Profile**: datos públicos del usuario (`profiles`); la identidad vive en `auth.users`.

## Where to look

- `DESIGN.md`: dirección Atlas vigente, herramientas UI reales, estado por módulo y continuidad para otros chats.
- `AGENTS.md`: reglas para agentes (issue tracker, triage labels, skills, hosting).
- `docs/ARCHITECTURE.md`: vision tecnica y flujo de datos.
- `docs/DECISIONS/`: ADRs (000 plantilla; 001 obsoleto; 002 InsForge; 003 OpenNext retirado;
  004 esquema; 014 Worker de assets estáticos).
- `docs/agents/`: como consumir `CONTEXT.md`/ADRs, issue tracker y labels de triage.

## Rules

- Si un doc y el codigo se contradicen, **gana el codigo** y el doc se corrige o se borra.
- Nunca versionar claves; los valores viven en `.env.local` (ignorado por git).
- No usar enums de Postgres; usar `text + CHECK` alineado con las uniones de TypeScript.
