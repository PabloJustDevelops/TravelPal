# MCPs (minimal productive code units) used in Trae

This project documents reusable patterns and connectors used in Trae:

- Centralized logger (`src/lib/logger.ts`): captures `debug|info|warn|error` levels and
  emits toasts.
- Global toasts (`src/lib/toast.ts`, `src/components/ui/Toast.tsx`): provider in
  `RootLayout`.
- Service clients (`src/lib/insforge.ts`): initialization and data helpers.
- Tests and audit (plan): `Jest` plus the option of `testsprite`.
- Modular UI: reusable components in `src/components/ui/*` and per domain.

These patterns speed up implementation without lowering the quality bar.
