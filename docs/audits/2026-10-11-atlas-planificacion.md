# QA Atlas: planificación, calendario y reservas

## Evidencia ejecutada

| Comando | Salida relevante | Código |
| --- | --- | --- |
| `pnpm run test:ci --runInBand` | 58 suites, 432 tests aprobados | 0 |
| `pnpm run type-check` | `tsc --noEmit`, sin diagnósticos | 0 |
| `pnpm run lint` | 0 errores, 21 avisos | 0 |
| `pnpm run build-storybook` | Storybook build completed successfully | 0 |
| `pnpm run test:storybook` | 7 archivos, 28 tests aprobados | 0 |
| `pnpm exec vitest run --project=storybook src/components/planning/BookingCard.stories.tsx` | 1 archivo, 5 tests aprobados; viewport 390 × 844 | 0 |
| `git diff --check` | sin salida | 0 |

La revisión independiente no encontró regresiones de propiedad de datos ni CRUD. El Storybook comprueba axe, selector de viewport, acciones y estado desplegado. El E2E autenticado del módulo completo se ejecutará en el CI del PR; el E2E local no dispone de credenciales en este entorno.

## Problema reproducido y corregido

En la historia de reserva pendiente a 390 px, «Eliminar» quedaba fuera de la tarjeta: la prueba devolvió `437 > 414`. El encabezado ahora apila el título y las acciones en móvil. La historia selecciona el viewport real de 390 × 844, comprueba `window.innerWidth`, mide que cada botón tenga al menos 44 px y confirma que todos queden dentro de la tarjeta sin scroll horizontal. La prueba corregida pasa.

Vitest informa que el cierre tarda más de diez segundos por recursos abiertos aunque devuelve código 0. El build muestra avisos de sourcemap/directivas de cliente y tamaño de chunks ya presentes en el catálogo.

## Alcance visual pendiente

Esta aprobación cubre las historias y componentes del módulo. No acredita aún la composición completa del boceto Atlas ni una auditoría visual de todas las rutas. Sigue pendiente el gate global descrito en `design-qa.md`.
