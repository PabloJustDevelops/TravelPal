# Atlas: primera base funcional

Pablo eligió la opción 1 clara y centrada en el viaje. ADR-008 registra esa elección.
La entrega aplica colores y titulares compartidos, navegación lateral, menú móvil con
estado activo y Escape, salto al contenido y una tarjeta de próximo viaje con datos reales.

No altera consultas ni permisos. Excluye viajes terminados y cancelados, prioriza los que
siguen en curso y compara timestamps en el calendario local del usuario. El panel de
notificaciones abre hacia arriba en el lateral; conserva su posición en móvil.

## Evidencia

| Comando | Salida | Código |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Lockfile is up to date, resolution step is skipped | 0 |
| `pnpm run type-check` | tsc --noEmit, sin diagnósticos | 0 |
| `pnpm run lint` | 23 problems (0 errors, 23 warnings), baseline anterior | 0 |
| `pnpm run test:ci --runInBand` | 56 suites, 416 tests passed | 0 |
| `pnpm run test:timezone` | 5 tests passed en Europe/Madrid | 0 |
| `TZ=UTC pnpm test --runInBand src/components/dashboard/__tests__/NextTrip.test.tsx` | 5 tests passed | 0 |
| `pnpm run test:e2e` con credenciales en el entorno | 17 passed; axe completo dentro de nav/main y diálogos, sin reglas desactivadas | 0 |
| `pnpm run test:tester` | 6 passed, escritorio y móvil | 0 |
| `pnpm run build-storybook` | Storybook build completed successfully | 0 |
| `pnpm run test:storybook` | 4 files, 15 tests passed; también con caché fría | 0 |
| `PATH=/tmp/travelpal-node22/node-v22.22.3-linux-x64/bin:$PATH pnpm exec opennextjs-cloudflare build` | Worker saved; OpenNext build complete | 0 |
| `node scripts/check-data-paths.mjs` | OK: sin puntos nuevos en el camino bff | 0 |
| `git diff --check` | sin salida | 0 |

Revisión independiente: los defectos de anclaje y zona horaria se reprodujeron, corrigieron
en un tercer contexto y revalidaron. La prueba de fecha pasa en UTC y Madrid; CI ejecuta
además la regresión de Madrid. No quedan hallazgos de la revisión.

## Capturas e interacciones

Las capturas muestran la cuenta de QA vacía, no datos de Pablo:

- [Móvil a 390×900](assets/atlas-light-390.png).
- [Escritorio a 1440×900](assets/atlas-light-1440.png).

El navegador de Codex comprobó el panel y el menú móvil. Los E2E comprueban además
notificaciones dentro del viewport, ausencia de desbordamiento, Escape y restauración
de foco, etiquetas de filtros y axe en claro/oscuro. Los tres nuevos escenarios de
Storybook cubren próximo viaje, oscuro y vacío con datos sintéticos.

## Límites

- Es la base del rediseño, no la reproducción completa del boceto: faltan hero fotográfico,
  itinerario, tareas y presupuesto integrados, y migración del resto de flujos. No se
  presentan fotos o cifras ficticias como datos reales. El gate visual completo sigue pendiente.
- Se conserva Headless UI. La skill oficial de shadcn está instalada; sus controles se
  integrarán por flujo cuando sustituyan un contrato concreto, sin añadir dependencias sin uso.
- Vitest mantiene el aviso de recursos abiertos tras diez segundos, con tests aprobados
  y código 0. Se preoptimiza next/link para evitar el fallo observado en caché fría.
- La burbuja de Next interceptaba la campana en el sidebar. Los runners locales ponen
  E2E_DISABLE_DEV_INDICATORS=1; Next sigue mostrando errores de compilación y ejecución.
- Una ejecución falló al volver a signin tras login. La repetición completa pasó, sin
  añadir retries. No se acredita aquí una corrección del flujo de autenticación.
- Siguen los avisos anteriores de lint y las alertas de dependencias existentes.
