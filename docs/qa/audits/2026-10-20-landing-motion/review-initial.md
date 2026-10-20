# Informe del revisor independiente · auditoría previa

[P2] Sitúa el footer fuera del contenido principal — `src/app/page.tsx:24`

El `<footer>` está dentro de `<main>`, así que no funciona como landmark global `contentinfo`. Sepáralo del contenido principal para facilitar su localización con tecnologías de asistencia.

La auditoría visual actual deja estas oportunidades, sin considerarlas regresiones de un diff:

- **Footer:** `Footer.tsx:5` reúne marca, copyright y acceso en una sola fila, sin información del proyecto. El repositorio real es `https://github.com/PabloJustDevelops/TravelPal`; `LICENSE` confirma MIT y copyright 2026 de Pablo Rodríguez Garijo. Son destinos verificables para enriquecerlo.
- **Legales y contacto:** no encontré páginas reales de privacidad, términos ni contacto en las rutas revisadas. Hay un hueco de contenido; no procede añadir destinos ficticios.
- **Foco y touch:** los enlaces del footer carecen de altura mínima y foco personalizado (`Footer.tsx:5`). Conviene igualarlos a los 44 px y al tratamiento de foco de `Brand.tsx:5` y del footer Mesa (`authStyles.module.css:13,21`). No afirmo ausencia de foco: permanece el nativo. Tampoco un incumplimiento de tamaño: la separación puede satisfacer la excepción de espaciado.
- **Año:** 2026 es correcto en las capturas. `new Date()` se evalúa al generar el export estático; no se actualizará sin reconstrucción. Es una condición de mantenimiento, no un error actual.
- **Ritmo:** el footer usa `max-w-7xl` y `sm:px-8`, frente al ancho mayor y `sm:px-12` de la cabecera. En 1440 px la marca termina más adentro. Es una oportunidad de alineación, sin desbordamiento observado.

Sin hallazgo visual en los demás puntos solicitados:

1. **Hero:** el h1 domina claramente. «Costa mediterránea» es un `span` decorativo dentro de `aria-hidden`, no un h2 (`Hero.tsx:26–28`).
2. **Contenido:** subtítulos y texto secundario permanecen legibles en claro y oscuro; no observé cortes, superposiciones ni saltos de ritmo que impidan recorrer la landing.
3. **Signin Mesa:** conserva marca, tipografía, colores, costa e ilustración editorial. En 390 px prioriza el formulario y oculta la historia lateral deliberadamente (`authStyles.module.css:40–45`).

Inspeccionadas las 12 capturas actuales de `docs/qa/audits/2026-10-20-landing-motion/`. No utilicé capturas históricas. La revisión cubre presentación y estructura; las imágenes no verifican teclado, lector de pantalla, motion ni autenticación real. El refresh anónimo simulado limita esta última comprobación. No he editado archivos ni aprobado cambios futuros.
