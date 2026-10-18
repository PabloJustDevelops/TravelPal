# TravelPal · propuestas para el interior

Fecha de los ejemplos: 16 de octubre de 2026. Estado: **dirección aprobada por Pablo el 16 de octubre; implementación autorizada y pendiente**.

Pablo aprobó las diez propuestas sin objeciones y pidió delegar su implementación
en chats nuevos, sin historial heredado, con subagentes cuando aporten valor.
La aprobación cubre el conjunto: no volver a pedir selección visual antes de
comenzar. Empezar por navegación compartida y dashboard; continuar por viajes,
planificación, tareas, gastos, notas, perfil y ajustes. Conservar los flujos
existentes y verificar cada entrega. Las imágenes siguen siendo propuestas,
no evidencia de implementación.

Pablo pidió una propuesta visual por sección, todas con el mismo estilo. Se generaron diez pantallas con la herramienta integrada Image Gen, ancladas en la landing aprobada, signup Mesa de viaje, las capturas reales del interior y DESIGN.md. La planificación incluye una corrección posterior del calendario de octubre; solo se conserva aquí el resultado corregido.

## Pantallas

- [Dashboard](01-dashboard.png): Próximo viaje, primeros planes, preparativos y presupuesto antes de estadísticas.
- [Viajes](02-viajes.png): Próximo viaje destacado y viajes pasados en filas; búsqueda y filtros discretos.
- [Crear viaje](03-crear-viaje.png): Formulario en una página con campos agrupados y resumen lateral.
- [Planificación](04-planificacion.png): Día seleccionado, agenda horaria, calendario compacto y reservas del viaje.
- [Tareas](05-tareas.png): Lista por estado, prioridades y fechas; cambio de estado sin arrastrar.
- [Gastos y presupuestos](06-gastos.png): Libro de movimientos con importes alineados y presupuesto contextual en EUR.
- [Añadir gasto](07-anadir-gasto.png): Importe y moneda primero, categorías compactas, fecha, viaje y notas.
- [Notas](08-notas.png): Lista y editor en dos paneles, filtros, favoritos y vista previa Markdown.
- [Perfil](09-perfil.png): Foto, nombre y email; estado de edición con acciones claras.
- [Ajustes](10-ajustes.png): Tema claro/oscuro/sistema, disponibilidad de notificaciones y recuperación de contraseña.

## Lenguaje común

Atlas Editorial: marca del globo azul, Inter, tinta azul marino, fondo papel claro, azul en acciones y selección, separadores finos y superficies abiertas. Ilustraciones únicamente en los destinos de ejemplo. Las imágenes de destinos en producción requieren una fuente adecuada; no asignar automáticamente la ilustración ficticia de Lisboa a cualquier viaje.

## Datos de los bocetos

Ana García y todos los viajes, notas, reservas e importes son ficticios y solo están en las imágenes. No se insertaron en ninguna base de datos. Viaje Lisboa: 18–23 octubre de 2026. Presupuesto ilustrativo: 900 EUR, gastos 420 EUR, disponible 480 EUR, uso redondeado 47 %. El calendario corregido sitúa el 19 de octubre en lunes y el 16 en viernes.

## Adaptación propuesta a móvil

Una columna; navegación compacta con acceso a las mismas seis secciones; filtros envueltos y no cortados. La agenda conserva el orden cronológico. En tareas, filas con selector explícito de estado. En gastos, cada movimiento mantiene importe y divisa visibles sin sumar monedas distintas. En notas, la lista conduce al editor con volver y protección de cambios pendientes. Los resúmenes laterales de formularios pasan después de los campos o se contraen; la imagen del destino nunca debe desplazar los controles esenciales.

## Movimiento propuesto

Transiciones cortas de 120–180 ms para pestañas, selección de día y apertura de paneles; foco inmediato en diálogos; feedback de guardado y validación junto al control. Sin tarjetas que se eleven, roten o entren escalonadas. En reduced motion los cambios ocurren sin desplazamiento animado. Son pautas propuestas, no animaciones implementadas ni verificadas.

## Ajustes antes de implementar

Normalizar medidas y anchura de sidebar entre imágenes: el generador no fija tokens CSS exactos. Evitar repetir la fecha de hoy en todas las cabeceras. En gastos, eliminar la repetición del mismo total/progreso entre cabecera y presupuesto lateral cuando solo haya un presupuesto. Mantener búsqueda, filtros, informes y acciones existentes aunque un estado no esté desplegado en el boceto. Lista/Tablero en tareas y la composición de dos paneles de notas son cambios de interacción a diseñar con teclado y móvil; no cambian el modelo de datos.

Estas imágenes no acreditan responsive, contraste WCAG, teclado ni flujos funcionales. No se ha modificado código de la app. /budget redirige a /expenses; /analytics y /alerts redirigen a /dashboard. El detalle del viaje y su diario no tienen un mockup independiente en esta serie y deben conservarse al implementar Viajes.

## Procedencia y verificación

Las referencias actuales están en ../../assets/dashboard-inspection-2026-10-16/, la landing en ../../assets/layout1-2026-10-13/reference.webp y signup en ../../assets/auth-mesa-2026-10-16/signup-light-1487.webp. manifest.json vincula los diez originales generados con sus copias, dimensiones y SHA-256. Inspección visual de los resultados en la conversación y validación de apertura de los diez PNG con Pillow. No se han ejecutado tests de app porque esta entrega solo añade propuestas visuales.

## Instrucciones de generación (resumen del conjunto de prompts)

Base: UI mockup de escritorio TravelPal en español, objetivo 1440 × 1024, una pantalla por imagen, fondo papel claro, Inter y azul de marca, navegación izquierda compartida, sin navegador ni dispositivo. Usar las referencias aprobadas para identidad y las capturas actuales para capacidades; datos ficticios anclados en 16/10/2026. Espaciado, alineación y tipografía antes de bordes; sin gradientes, vidrio ni tarjetas anidadas. No inventar mapas, tiempo, IA, colaboración o integraciones bancarias. Cada descripción de pantalla anterior fija su objetivo y composición. Los prompts completos y referencias exactas usados constan en las llamadas Image Gen de este chat.
