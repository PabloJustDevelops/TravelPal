# ADR-008: Atlas claro, centrado en el viaje

## Estado

Dirección aprobada por Pablo el 10 de octubre de 2026: «1 · Claro y centrado en el viaje».

Sustituye la paleta y la jerarquía editorial del ADR-007. Conserva sus tokens semánticos, la fuente Inter, los controles compartidos y el soporte de oscuro.

## Decisión

- Fondo blanco, superficies neutras frías, azul para navegación y acciones, verde para éxito.
- Navegación lateral desde 1024 px; menú desplegable en móvil con enlaces de al menos 48 px.
- Panel centrado primero en el viaje en curso o la salida futura más cercana, con acceso a su detalle.
- Datos de la cuenta y filtros existentes. Nada de fechas, tareas, fotos de destino o importes ficticios del boceto en la app.
- Inter para titulares y cuerpo; Fraunces sigue disponible para pantallas pendientes de migrar.

## Migración

Primera entrega: tokens, armazón y próximo viaje, sobre la base pnpm/Storybook del PR de infraestructura. Las gráficas y el informe siguen disponibles.

Después: detalle del viaje e itinerario, tareas y gastos, notas, autenticación y landing. Cada módulo conserva rutas y contratos, incorpora estados vacío/error/carga, y pasa teclado, contraste, móvil y E2E antes de sustituir al anterior.

La imagen seleccionada guía composición y jerarquía; la primera entrega no es una reproducción completa. No añade mapa, fotografía, presupuesto ni tareas al panel sin un flujo y una fuente de datos reales.

## Riesgos

Las pantallas con colores y fuentes locales requieren QA durante su migración. No se ha elegido ni instalado una librería de mapas. shadcn/Base UI se incorporará por control cuando mejore el contrato existente; no se sustituye de golpe Headless UI.
