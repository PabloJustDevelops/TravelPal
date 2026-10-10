# Auditoría QA y plan de UX — 2026-10-10

## Alcance y método

Revisión de la aplicación publicada en `app-viajes.prg-dev.workers.dev`, en escritorio y
viewport de 390×844, con la cuenta aislada autorizada para QA. Se recorrieron Dashboard,
Tareas, Viajes, Planificación, Gastos, Notas, Perfil y Configuración. Se inspeccionaron sin
guardar los formularios de tareas, notas y perfil. Playwright ejecutó las pruebas que crean
viajes, actividades, gastos y fotos y comprobó su limpieza posterior. No se cambió ninguna
preferencia de la cuenta durante la inspección.

La aplicación publicada seguía en el SHA `dd95e8e` durante la inspección. El ajuste de textos
de push descrito abajo está en la rama de trabajo y aún requiere pasar CI y desplegarse.

## Hallazgos

| Prioridad | Área | Evidencia | Efecto |
|---|---|---|---|
| P1 | Notas, contraste | En tema oscuro, las etiquetas “Categoría” y “Contenido” usan `rgb(58, 52, 44)`, mientras el texto normal usa `rgb(239, 233, 222)`. La captura del formulario muestra las primeras casi ilegibles sobre el fondo oscuro. | Dificulta completar el formulario y falla el contraste mínimo esperado para texto normal. |
| P1 | Tareas, accesibilidad | El diálogo “Nueva Tarea” muestra título, descripción y fecha como texto genérico y controles con placeholder; inspección DOM: los tres campos no tienen `<label>`, `aria-label` ni `labels` asociados. | Los campos no tienen un nombre accesible programático fiable para lectores de pantalla y automatización por rol/etiqueta. |
| P1 | Ajustes, notificaciones | La aplicación publicada dice que las notificaciones push llegarán aunque la app esté cerrada y el interruptor invita a activarlas. La entrega de servidor no existe según ADR-013. Esta rama ya corrige el texto y desactiva nuevas altas, conservando la baja de suscripciones antiguas. | La interfaz promete una capacidad que no se entrega. Falta validar este arreglo en producción tras CI y deploy. |
| P2 | Tareas, móvil | A 390×844 el tablero convierte las columnas en paneles verticales altos, cada uno con scroll interno, mientras la página también desplaza. En el viewport de escritorio observado, las columnas ocupan más ancho que el área visible. | Navegación y arrastre del tablero se sienten pesados en móvil; en escritorio una columna queda parcialmente fuera del viewport. |
| P2 | Dashboard sin datos | Dos paneles de gráficos conservan grandes áreas vacías y dicen “No hay datos suficientes”; el CTA de creación de viaje está en una ruta distinta, accesible por menú o enlace “Ver todos”. | Primera sesión poco orientada: mucho espacio vacío y débil siguiente acción. |
| P2 | Gastos, moneda | En la cuenta sin datos, el total de gastos muestra `0,00 €` y el resumen de presupuesto `0,00 US$`. | La moneda parece inconsistente; reproducir con un gasto real y preferencia de moneda antes de cambiar la regla. |
| P3 | Registro, datos de prueba | El smoke de Playwright de registro deja deliberadamente una cuenta sin verificar; su comentario indica que no hay mecanismo de borrado de usuarios en esa suite. | La CI acumula cuentas de prueba y envía códigos a direcciones `example.com` que nadie lee. Resolver antes de aumentar la frecuencia de ejecución. |

## Cobertura verificada

- `npm run test:e2e` con cuenta de QA: 9 pruebas aprobadas. Incluye acceso, registro hasta
  verificación, viajes, planificación, gastos, diario con foto y borrado con comprobación de
  gasto desacoplado.
- La suite elimina con la sesión propia los viajes y sus filas/fotos; tras la ejecución, el
  dashboard de la cuenta quedó vacío.
- `npm run test:tester`: seis ejecuciones aprobadas, tres casos en escritorio y viewport
  estrecho; solo cubre pantallas públicas.
- `npm run test:ci -- --runInBand`: 53 suites y 404 pruebas aprobadas.
- La consola del navegador no mostró errores ni avisos durante la navegación manual.

No cubre Safari/iOS, WebKit, Firefox, una prueba táctil real, OAuth de Google con proveedor,
verificación automatizada del correo, carga completa de tareas/notas/perfil/ajustes ni push
entregado en segundo plano. El runner de Tester Army usa assertions deterministas; no usa
modelos ni comparte autenticación de Codex.

## Plan de refactorización UX y QA

1. **Cerrar defectos de accesibilidad antes del rediseño.** Asociar etiquetas y errores a los
   campos de Tareas y Notas; corregir contraste en temas claro/oscuro; probar foco, teclado,
   lectores de pantalla y axe en formularios y diálogos. Ya se corrigió la asociación del campo
   de correo de recuperación, con prueba de regresión.
2. **Resolver responsive por flujo.** Empezar por el tablero de Tareas: decidir un patrón móvil
   sin scroll vertical anidado, revisar ancho de columnas y navegación por teclado. Revisar
   luego Planificación, Gastos y editor de Notas a 390 px y escritorio amplio.
3. **Mejorar estados vacíos y claridad de datos.** Diseñar para Dashboard y cada módulo un
   primer paso visible, explicar por qué está vacío y mostrar CTA contextual. Acordar una sola
   regla visible de moneda y probarla con varias divisas.
4. **Completar el cinturón E2E.** Separar las cuentas creadas por test de las que inician sesión;
   sustituir el smoke que deja usuarios pendientes por un entorno con limpieza segura o una
   prueba que no escriba en el backend. Añadir flujos de tareas, notas, perfil y ajustes con
   datos prefijados y cleanup en `finally`/`afterEach` bajo RLS.
5. **Añadir regresión visual y exploración.** Acordar primero la dirección visual; entonces
   generar baselines en Linux para las vistas críticas y aceptar cambios visuales mediante
   revisión. Reservar exploración con modelo para una instancia local/staging con datos
   descartables y presupuesto explícito; no meter llamadas variables al modelo en el gate.
6. **Refactorizar por módulos, con evidencia.** Inventariar componentes/tokens compartidos y
   migrar un flujo cada vez. Para cada módulo, conservar pruebas Jest de lógica, E2E de camino
   feliz y errores, responsive, teclado/axe y screenshots de regresión antes de avanzar.

La auditoría no elige una estética nueva. La dirección visual queda pendiente de revisar estos
hallazgos con el propietario, conforme a ADR-007.
