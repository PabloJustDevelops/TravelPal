# TravelPal · integración del layout 1

Fecha: 13 de octubre de 2026. Worktree: `codex/auth-brand-a11y`, asociado al PR #94. Alcance de esta iteración: landing y sus pruebas; no cambia la lógica de autenticación ni los módulos privados.

## Referencia y comparación

La referencia elegida por Pablo es la imagen adjunta del layout 1. Original: 1487 × 1058 px. Implementación: viewport de 1440 × 1024 CSS px, deviceScaleFactor 1; relación de aspecto equivalente. La variante móvil se comprobó a 390 × 1024 px. Las capturas finales abren la portada sin ancla, esperan las fuentes y se guardan desde el inicio; no se reutilizan las capturas desplazadas de las primeras pasadas.

- [Referencia](docs/design/assets/layout1-2026-10-13/reference.webp).
- [Escritorio claro](docs/design/assets/layout1-2026-10-13/desktop-light.webp).
- [Escritorio oscuro](docs/design/assets/layout1-2026-10-13/desktop-dark.webp).
- [Móvil claro](docs/design/assets/layout1-2026-10-13/mobile-light.webp).
- [Móvil oscuro](docs/design/assets/layout1-2026-10-13/mobile-dark.webp).

## Superficies de fidelidad

| Superficie | Comprobación y resultado |
| --- | --- |
| Tipografía | Inter real: 117.36 px y line-height 115.013 px para el titular a 1440 px, medido en navegador. Se conservan las dos líneas y la jerarquía de la referencia; en móvil la segunda línea se divide sin desbordar. La nota del destino usa Fraunces cursiva existente, en lugar de simular la letra manuscrita del mock. |
| Layout y espaciado | Cabecera ligera, titular sobre el paisaje, panorama sin tarjeta y franja horizontal de ejemplo. En móvil, acciones antes del paisaje y paradas apiladas. Se eliminó el exceso de espacio vacío móvil observado en la primera revisión. |
| Colores | Tokens Atlas del repositorio: fondo claro, tinta, neutros y azul para acciones; las mismas variables mantienen la variante oscura. Axe no reporta violaciones en las rutas y temas evaluados. |
| Imágenes | Panorámica creada con ImageGen a partir de la ilustración original y el mock aprobado. WebP 1774 × 887, 323360 bytes, alpha real; no se usa una captura con texto como fondo. `sizes` contempla el encuadre de 200vw en móvil para evitar una imagen demasiado pequeña. Las imágenes cargan en las pruebas. |
| Contenido | Titular, subtítulo, CTA, destino y tres paradas del mock. Los valores están rotulados como «Viaje de ejemplo». No son datos del usuario ni se guardan. Las secciones siguientes explican funciones existentes sin tarjetas repetidas ni testimonios. |

## Interacción y movimiento

«Crear mi viaje» abre `/signup`; «Entrar» abre `/signin`; «Ver un ejemplo» lleva a `#example`. Las tres paradas se pueden seleccionar con clic y teclado: flechas, Home y End, foco y estado seleccionado. El panel explica la parada seleccionada y cambia con una transición de 180 ms; la regla global de movimiento reducido elimina el desplazamiento. No hay bucles, scroll bloqueado ni animaciones repetidas por sección. Probado el cambio a «Alojamiento» en el navegador de la app.

El panel de detalle y el subrayado seleccionado son una adaptación funcional del mock estático. Se utilizan Button, tokens e iconos Heroicons existentes. No se introducen dependencias ni backend nuevo.

## Incidencias resueltas y diferencias menores

- El test global del sistema de diseño rechazó nuevos botones nativos; las pestañas ahora usan `Button` compartido, que reenvía el ref.
- El primer encuadre móvil dejaba demasiado cielo transparente; se compactó y volvió a capturar.
- Las primeras capturas podían conservar el ancla del menú móvil; la captura final vuelve a `/` y espera las fuentes.
- P3: la tipografía de la anotación y las siluetas de iconos no son idénticas al raster generado. Se conservan fuentes e iconos reales del sistema; no son placeholders. La panorámica es una derivación de la ilustración original, no una coincidencia píxel a píxel.

Sin P0/P1/P2 abiertos. Revisión independiente read-only: sin hallazgos, incluido el uso final de Button.

## Validación ejecutada

```bash
pnpm exec jest --runInBand --coverage=false
```

Salida 0: `Test Suites: 64 passed, 64 total`; `Tests: 460 passed, 460 total`. Hay avisos de consola existentes de pruebas mock/act; no se ocultan como una salida completamente silenciosa.

```bash
NEXT_PUBLIC_INSFORGE_URL=https://example.invalid NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder INSFORGE_API_KEY=qa-placeholder E2E_BASE_URL=http://localhost:3010 pnpm exec playwright test e2e/smoke/landing-auth-layout.spec.ts e2e/smoke/signup-accessibility.spec.ts e2e/smoke/signin-controls.spec.ts --project=smoke --workers=1
```

Salida 0: `27 passed (31.2s)`. Incluye landing, signin, signup, recuperación y reset a 390/1440 px en claro/oscuro, axe, imágenes cargadas, ausencia de desbordamiento, teclado del ejemplo y prefers-reduced-motion. Entorno ficticio; no valida altas, correos ni resets reales.

```bash
pnpm exec eslint src/components/landing src/app/page.tsx e2e/smoke/landing-auth-layout.spec.ts e2e/smoke/signup-accessibility.spec.ts
pnpm run type-check
git diff --check
```

ESLint: salida 0 sin mensajes. TypeScript: salida 0, `$ tsc --noEmit`. Diff check: salida 0 sin mensajes.

```bash
IMPECCABLE_HOME=/tmp/travelpal-impeccable-cache /tmp/travelpal-impeccable-20261013/.agents/skills/impeccable/scripts/impeccable detect --json src/components/landing/Hero.tsx src/components/landing/Navbar.tsx src/components/landing/ExampleJourney.tsx src/components/landing/Features.tsx src/components/landing/HowItWorks.tsx src/components/landing/CTA.tsx src/components/landing/Footer.tsx src/components/landing/Brand.tsx
```

Salida 0: `[]`. Detector oficial ejecutado desde copia temporal; no se instalaron hooks. Su resultado no sustituye la comparación visual.

## Entrega

- Landing integrada y capturas finales inspeccionadas.
- Rutas, controles de ejemplo y menú comprobados.
- Claro/oscuro, teclado, movimiento reducido y pruebas pasadas.
- Recursos con alt, crédito y procedencia en `public/images/atlas/README.md`.
- No hay commit, push, merge ni deploy en esta entrega.

Resultado de esta entrega: `passed` para landing; no representa el gate visual global.

## Lista/alta y planificación

La lista y el alta conservan filtros, autenticación, validación de fechas y presupuesto parcial; los E2E autenticados del PR pasaron antes de esta etapa de planificación. Planning conserva sus consultas y mutaciones; calendario, tarjetas y formularios tienen historias y pruebas. La historia de reserva comprueba acciones dentro de un viewport de 390 × 844. Evidencia de esta etapa: `docs/audits/2026-10-11-atlas-planificacion.md`. Falta ejecutar el E2E autenticado sobre el estado final del módulo y completar el gate visual global.

final result: blocked

El E2E autenticado de la página completa queda pendiente sobre el estado integrado y el gate visual global sigue bloqueado.

Resultado global: `blocked` hasta completar ambos gates.
