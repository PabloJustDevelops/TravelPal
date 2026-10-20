# Auditoría inicial · landing · 20 de octubre de 2026

Base: `design/landing-detalles`, `9f1abff`. Capturas de esta ejecución antes de modificar código: `before-{1440,390}-{light,dark}.png`, recortes `before-footer-*` y `signin-*`. Se recorrieron todas las secciones a 1440×900 y 390×900, claro/oscuro, con movimiento reducido. Chromium local mediante Playwright autorizado por Pablo al no haber navegador integrado. Para signin se simula respuesta anónima `{}` del backend `example.invalid`; no se prueba autenticación real. Los indicadores de desarrollo de Next se ocultan únicamente en capturas.

## Hallazgos iniciales

Informe original del revisor independiente: [review-initial.md](review-initial.md). La tabla añade severidad de priorización y medidas de navegador; los hallazgos visuales no se atribuyen como regresiones.

| Severidad | Fichero y línea en la base | Problema observado |
|---|---|---|
| Media | `src/components/landing/Footer.tsx:5` | Una sola fila agrupa marca, copyright y acceso. No hay explicación del producto ni grupos de producto/proyecto; el copyright interrumpe la navegación. En móvil se mantiene ese orden. |
| Media | `src/components/landing/Footer.tsx:5` | Los enlaces miden 20 px de alto: inferiores al objetivo interno de 44 px. Solo declaran hover y dependen del foco nativo; falta el foco Atlas consistente. No equivale por sí solo a afirmar incumplimiento WCAG por tamaño o ausencia total de foco. |
| Media | `src/app/page.tsx:17` y `:24` | Footer anidado en main: no actúa como landmark contentinfo global. |
| Baja | `src/components/landing/Footer.tsx:5` | `new Date().getFullYear()` se ejecuta durante el export. Hoy 2026 es correcto, pero seguirá mostrando el año de build al cambiar de año sin reconstrucción. |
| Media | `src/components/landing/Navbar.tsx:19` y `:20` | Enlaces de escritorio de 20 px y sin foco explícito coherente con la marca/CTA. |
| Baja | `src/components/landing/Footer.tsx:5` | Faltan referencias reales al proyecto académico, repositorio y licencia. `origin` confirma `https://github.com/PabloJustDevelops/TravelPal`; LICENSE es MIT. No se han encontrado páginas de privacidad, términos ni contacto: no se inventarán destinos. |

| Baja | `src/components/landing/Footer.tsx:5` | El contenedor max-w-7xl desplaza la marca respecto a la cabecera max-w-[1600px] a 1440. Alinear los márgenes refuerza el cierre de página. |

## Aspectos revisados sin cambio solicitado

- Ritmo: franja de ejemplo compacta; features más espacioso; pasos abiertos y CTA separado por línea. Las cuatro capturas no muestran solapamientos ni desbordamiento. Se conserva el ritmo aprobado, sin homogeneizar secciones con funciones diferentes.
- Jerarquía: un solo h1, 117.36 px a 1440 y 44 px a 390. La leyenda del hero es un span decorativo aria-hidden, no un h2; los h2 de secciones mantienen una escala inferior. No se justifica cambiar titulares.
- Texto secundario: tokens muted adaptados a claro/oscuro. `node /tmp/landing-audit-check.cjs` devuelve `violations: []` para las cuatro combinaciones, exit 0; no permite afirmar accesibilidad completa ni probar estados aún no visibles.
- Mesa de acceso: comparte marca, papel, tinta, azul e ilustración costera. El bodegón y la simplificación móvil están aprobados en DESIGN.md. Cambia la tarea (presentación → acceso), sin promesa contradictoria observada. No se modifican páginas de acceso/interior.
- Imágenes: dimensiones declaradas existentes; faltan placeholder entonado y fundido de carga. Hero es la única imagen de landing precargada.

## Línea base

- `pnpm run lint`: exit 0, `✖ 13 problems (0 errors, 13 warnings)`.
- `pnpm exec jest --runInBand --coverage=false`: exit 0, `Test Suites: 68 passed, 68 total`, `Tests: 485 passed, 485 total`.

Se documentarán implementación, revisión final, capturas y gates en `verification.md`. El informe inicial precede a cualquier cambio de implementación.
