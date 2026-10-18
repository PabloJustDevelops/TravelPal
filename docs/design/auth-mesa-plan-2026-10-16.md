# Auth Mesa de viaje — plan de implementación

Selección aprobada: opción 2, referencia persistida en `assets/auth-mesa-2026-10-16/reference.png`.
Worktree `codex/auth-brand-a11y`. Alcance: presentación de signup/signin, assets y QA.

1. Persistir y abrir referencia y landing; mapear shell, formularios y recuperación.
2. Generar `auth-travel-notebook.webp`: recurso independiente con transparencia, gouache mediterráneo.
3. Añadir variante editorial del shell para signup/signin; mantener variante anterior para recovery/reset. Inter, tokens Atlas, composición blanca sin tarjeta. En móvil ocultar la promoción y priorizar formulario.
4. Adaptar tamaños/espaciado de formularios, separador Google, enlaces de cuenta, errores accesibles y objetivos táctiles. Mantener lógica, esquemas, OAuth, OTP y estados.
5. Comprobar contratos de páginas y errores; ejecutar TypeScript, ESLint, Jest y Playwright/axe. Capturar 1487×1058 y 390 px, ambos temas; comparar referencia e implementación juntas.
6. Revisión independiente y actualización de DESIGN e informe QA propio; sin commit/push/deploy.

Riesgos a revisar: shell compartido, registro que pasa a OTP, mensajes callback, contraste oscuro, contenido móvil sin panel promocional, crecimiento del formulario al validar.
