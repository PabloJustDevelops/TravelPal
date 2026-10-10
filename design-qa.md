# QA visual: Atlas

- Source visual truth: `docs/design/atlas-reference.png`, opción 1 seleccionada por Pablo.
- Implementation screenshot: `docs/audits/assets/atlas-light-1440.png`; móvil: `docs/audits/assets/atlas-light-390.png`.
- Source pixel dimensions: 1487×1058.
- Viewports de implementación: 1440×900 y 390×900, density 1. Capturas sin normalización.
- Estado: cuenta QA autenticada sin viajes, tema claro. El boceto muestra un viaje poblado a Lisboa. Los estados y encuadres no coinciden; no se declara comparación de fidelidad ni un resultado visual aprobado.

## Hallazgos pendientes del rediseño completo

- [P1] El hero fotográfico y los bloques integrados de itinerario, tareas y presupuesto del boceto no están implementados. La primera entrega prepara tokens, navegación y próximo viaje real.
- [P2] Las gráficas y módulos anteriores conservan su composición mientras se migran por flujo.

## Superficies y evidencia

Inter y los colores azul/neutros se han aplicado al armazón. El ritmo de navegación y los controles se comprobaron en navegador y E2E. Las imágenes y composición final requieren una siguiente implementación; no se ha sustituido la imagen del boceto por arte CSS. El contenido proviene de la cuenta, con estado vacío real.

No se hizo una comparación combinada ni de regiones con el boceto poblado porque no se ha construido todavía ese estado completo. La validación funcional de la base (teclado, foco, notificaciones, axe y móvil) está documentada en `docs/audits/2026-10-10-atlas-base.md`; no sustituye el gate visual.

## Implementación pendiente

1. Completar composición y flujos del dashboard con fuentes reales de datos.
2. Capturar el mismo viewport y estado que el objetivo.
3. Comparar juntos ambos artefactos y regiones relevantes, corregir P0/P1/P2 y repetir.

final result: blocked
