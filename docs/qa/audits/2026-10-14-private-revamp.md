# Revamp de las superficies privadas — 14 de octubre de 2026

## Alcance y evidencia visual

Continuación de Atlas (ADR-008) y del layout de landing elegido por Pablo.
Se leyeron las specs/auditorías anteriores y el código de dashboard, viajes,
planificación, tareas, gastos/presupuestos, notas, perfil y ajustes. Se usaron
Product Design Audit y la guía de shadcn para comprobar el sistema existente.
No se instaló otra biblioteca de UI; shadcn/Base UI sigue siendo una incorporación
gradual prevista, mientras los controles actuales son locales y Headless UI.

Las capturas son componentes reales de Storybook con datos sintéticos, **no rutas
autenticadas completas**. El componente de colecciones reúne gastos y notas para
compararlos, aunque en producción siguen siendo páginas distintas.

Capturas actuales en `docs/design/assets/private-2026-10-14/`:

- `collections-desktop-light.jpg` y `collections-desktop-dark.jpg`: 1440 × 1000.
- `collections-mobile-light.jpg` y `collections-mobile-dark.jpg`: imágenes de
  375 × 812; el viewport DOM de la comprobación fue 390 × 844. La herramienta de
  captura produjo esas dimensiones distintas; las pruebas de ancho se hicieron
  en Chromium a 390 px y no se deducen de la resolución de estos JPEG.
- `tasks-desktop-light.jpg`: tablero neutral, acciones visibles y selector de estado.
- `tasks-mobile-long-list.jpg`: final de la lista de once tareas tras desplazar el
  documento, imagen de 375 × 812; el viewport probado fue 390 × 844.
- `planning-desktop-light.jpg`: primer día abierto, dos actividades y monedas separadas.
- `empty-desktop-light.jpg`: cabecera y vacío compartido alineado a la izquierda.

## Hallazgos y cambios

1. **P2, mezcla de jerarquías.** `CardTitle` conservaba Fraunces mientras las
   cabeceras usaban Inter. Se unificó Inter, títulos privados compactos y nivel de
   encabezado configurable. Perfil y formularios de gasto usan secciones de nivel 2.
2. **P2, acciones escondidas.** Editar nota/gasto dependía de hover; las notas
   tenían botones sin nombre y el gasto anidaba botón en enlace. Ahora hay nombres
   accesibles, objetivos de 44 px y visibilidad sin hover. Las pruebas de páginas
   usan los nombres de los controles en vez de clases CSS/orden de botones.
3. **P2, ruido visual y modo oscuro.** Se quitaron sombras al hover y categorías
   arcoíris de gastos/notas/planner. Fondo, superficies y categorías usan tokens
   semánticos. El estado del viaje, el error del editor y los formularios de gastos
   ya no dependen de colores crudos de tema claro.
4. **P2, formularios y perfil.** Etiquetas enlazadas a moneda/viaje/notas y campos
   del perfil, categorías agrupadas en fieldset con foco visible, errores de gasto
   con `role=alert`. Avatar compacto y disparador mediante el Button compartido.
5. **P2, tablero.** Columnas neutras con línea de estado y tarjetas sin elevación o
   rotación. Selector de cambio de estado de 44 px. La página crece de forma natural
   en móvil, manteniendo scroll interno por columna desde `md`.
6. **Documentación contradictoria.** `DESIGN-DIRECTIONS.md` se declara histórico y
   apunta a ADR-008. `DESIGN.md`, enlazado desde `CONTEXT.md`, registra dirección,
   stack real, reglas, estado por módulo y cómo retomar en otros chats. Los informes
   históricos no son evidencia de verificación actual; no se reescribió el WIP ajeno.

## Revisión independiente y regresiones corregidas

El revisor detectó dos regresiones antes de entregar:

- El scroll móvil del tablero se había retirado mientras la página conservaba altura
  fija y `overflow-hidden`. Se corrigieron los ancestros y se añadió `MobileLongList`
  con once tareas y contenedores de página. La story falló antes del arreglo con
  `scrollY=0`. El revisor midió después `scrollY=1576`, ancho 390 y último encabezado
  a 688,39 px, dentro del viewport de 844 px.
- La variante ghost del avatar sustituía el fondo al hover y ocultaba el icono.
  Se conserva ahora `ink/80` en hover. El revisor comprobó el CSS real y el tamaño
  96 × 96; contraste conservador de 9,45:1 en claro y 9,90:1 en oscuro.

La segunda revisión no encontró otros problemas en los cambios asignados.

## Verificación

Los comandos se ejecutan en el worktree `codex/auth-brand-a11y`; las variables de
backend usadas en build/tests son valores ficticios, no credenciales.

La línea base de Jest fue 64 suites y 460 tests aprobados. Los primeros intentos
detectaron selectores de test ligados a `.group`, botones sin nombre, jerarquía de
encabezados y una declaración JSX incompleta. Se corrigieron antes de repetir las
suites. La story larga también necesitó usar el Button compartido para cumplir la
guardia de controles. Después se repitieron Jest y Storybook completos.

Resultados finales, todos con código de salida **0**:

```text
pnpm exec jest --runInBand --coverage=false
Test Suites: 64 passed, 64 total
Tests:       460 passed, 460 total

NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder INSFORGE_API_KEY=qa-placeholder pnpm exec vitest run --project=storybook
Test Files  9 passed (9)
Tests       39 passed (39)

pnpm run type-check
$ tsc --noEmit

NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder INSFORGE_API_KEY=qa-placeholder pnpm run build
✓ Compiled successfully
○ (Static) prerendered as static content
ƒ (Dynamic) server-rendered on demand

git diff --check
(sin salida)
```

ESLint focalizado: salida 0, `0 errors, 1 warning`; la advertencia de `<img>` en
perfil ya estaba en el código previo. Comando completo:

```bash
pnpm exec eslint src/components/ui/Card.tsx src/components/ui/PageTitle.tsx src/components/ui/EmptyState.tsx src/components/ui/Workspace.stories.tsx src/components/layout/DashboardLayout.tsx src/components/tasks/TaskBoard.tsx src/components/tasks/TaskCard.tsx src/components/tasks/TaskBoard.stories.tsx src/components/notes/NoteCard.tsx src/components/notes/NoteEditor.tsx src/components/expenses/ExpenseCard.tsx src/components/budget/BudgetCard.tsx src/components/planning/ItineraryPlanner.tsx src/app/profile/page.tsx src/app/settings/page.tsx src/app/tasks/page.tsx src/app/expenses/new/page.tsx 'src/app/expenses/[id]/edit/page.tsx' 'src/app/trips/[id]/page.tsx' src/app/expenses/__tests__/page.test.tsx src/app/notes/__tests__/page.test.tsx src/__tests__/design-system.test.ts
```

Vitest emitió `close timed out after 10000ms` al cerrar procesos, después de aprobar
las pruebas y terminar con salida 0. Se registra como limitación de teardown.
El escaneo estático de las líneas añadidas de producción dio 0 aciertos de secretos
embebidos o sinks peligrosos; no sustituye una auditoría de seguridad completa.

## Bloqueo de verificación autenticada

Se inició la app a petición de Pablo usando la configuración local existente a
través del cargador de entorno de Next, sin imprimir ni modificar sus valores.
El arranque real mostró `Next.js 16.3.8` y `Ready in 398ms` en el puerto 3010.

La herramienta de navegador rechazó abrir `http://localhost:3010/` por su política
de acceso a URLs. No se intentó eludir ese rechazo. Tampoco hay credenciales E2E
disponibles en el entorno de esta sesión. El arranque no acredita que las rutas
privadas funcionen ni sustituye una captura autenticada.

Falta comprobar las rutas reales con sesión, especialmente formularios de gastos,
perfil/avatares, ajustes, estados de error y listas pobladas. La app y Storybook
quedan levantados; las imágenes y pruebas de componentes sirven para revisar la
composición mientras se resuelve el acceso. No hubo commit, push, merge ni deploy.

**Estado de la auditoría al redactarse (14-10-2026): bloqueada la verificación autenticada completa.** La rama continúa bajo revisión; esta nota describe el límite de la pasada visual y no el estado de integración del PR.
