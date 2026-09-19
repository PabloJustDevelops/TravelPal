# ADR-012: Retirada del código BFF y de `public.users`

## Contexto

ADR-009 dejó `requireUser`, `ensureUserExists` y `useApiResource` sin llamadores como limpieza de
la etapa 4 del #38; esa etapa se gastó en #53 y #56. `public.users` solo la escribía
`ensureUserExists`; en producción tiene 0 filas y 0 FKs entrantes; `profiles` es el perfil real.

Efecto medido del #38 en el Worker (job deploy, línea `Total Upload`): de 13864.67 KiB / 2843.16 KiB
gzip (main @3b84755, antes de la etapa 0) a 13258.90 KiB / 2755.23 KiB gzip (main @96d909f, etapa
4): −605.77 KiB (−4,4 %) y −87.93 KiB gzip (−3,1 %).

## Decisión

1. Borrar las funciones/tipos/hook y sus tests; `createServerInsforgeClient` se conserva porque lo
   usa `auth-actions.ts`.
2. El guardián sigue vigilando `useApiResource(` como valla.
3. `public.users` sale del modelo con la migración `20260918210000_drop-public-users.sql`,
   pendiente de aplicar con aprobación humana (DROP en producción pasa por el guard de InsForge);
   hasta entonces la tabla vacía no rompe nada.
4. Docs alineadas (ARCHITECTURE, TECHNICAL, CONTEXT, ADR-002).

## Consecuencias

Menos superficie; el modelo de `CONTEXT.md` coincide con el backend; una migración pendiente de
aplicar. Alternativa descartada: conservar la tabla «por si acaso» (mantiene 3 políticas RLS que el
advisor cuenta como deuda y una doc que miente).

## Estado

Aprobado.
