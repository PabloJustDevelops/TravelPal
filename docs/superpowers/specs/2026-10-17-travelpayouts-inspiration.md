# Inspiración de vuelos con Travelpayouts

## Objetivo

Ofrecer a usuarios autenticados de TravelPal ideas de vuelos de Aviasales basadas en los
precios recientes disponibles en Travelpayouts Data API. La consulta sirve de inspiración:
no reserva vuelos ni garantiza precio o disponibilidad. El usuario podrá llevar una idea al
formulario existente para crear un viaje, o abrir Aviasales para comprobarla.

## Restricciones actuales

- Producción es un export estático de Next.js servido por un Worker assets-only. No se pueden
  usar Route Handlers de Next.js ni añadir un servidor de aplicación a Cloudflare.
- La sesión vive en el SDK cliente InsForge; la app no debe extraer ni almacenar tokens mediante
  APIs internas del SDK. `functions.invoke` adjunta la sesión del usuario.
- El token Travelpayouts no debe aparecer en el bundle, respuestas al cliente, logs, URL, repo ni
  artefactos de CI. Se lee únicamente desde un secreto de la función InsForge.
- `/trips/:id` se redirige a `/trip?id=:id` en Cloudflare. La nueva sección usa
  `/travel-inspiration` para evitar esa colisión.
- El alta de proyecto Travelpayouts está en revisión. La integración no debe asumir que el estado
  «available» de una credencial implica aprobación para usar el programa de Aviasales o enlaces
  de afiliado.

## Experiencia y flujo

1. Añadir «Inspiración de vuelos» dentro de la navegación de viajes y ofrecer un acceso desde la
   página de viajes. La página es estática y su interfaz de datos se hidrata en cliente.
2. El usuario elige origen IATA, mes entre el actual y los doce siguientes, solo ida o ida y vuelta,
   y opcionalmente un máximo en EUR entre 0 y 100000. La primera carga comprueba configuración sin consultar precios.
3. El cliente llama la Edge Function `travel-inspiration` usando `insforge.functions.invoke`.
   La función verifica `Authorization` contra InsForge, valida todos los parámetros y solo llama
   al endpoint fijo de precios de Aviasales por HTTPS.
4. Se normalizan y filtran las filas: moneda EUR; origen solicitado; destino distinto; fechas
   futuras y válidas; `actual` y `show_to_affiliates`; `found_at` de menos de 48 horas. Se ordenan
   por precio, se eliminan duplicados y se devuelven como máximo doce resultados.
5. Cada idea permite abrir Aviasales y pasar origen, destino y fechas sugeridas al formulario
   existente. Las fechas son referencias sin horas; el usuario revisa y completa los datos antes
   de guardar. No se crea un viaje automáticamente.
6. Si la sesión, configuración, proveedor o resultados fallan, la interfaz informa el estado y
   conserva la alternativa de creación manual.

## Backend y seguridad

- Fuente: Edge Function de InsForge, slug `travel-inspiration`, que debe estar desplegada y activa.
- Autorización: exigir bearer de sesión, comprobarlo con `auth.getCurrentUser()` y rechazar antes
  de consultar al proveedor si no existe usuario autenticado. No confiar en IDs enviados por cliente.
- Secretos: `TRAVELPAYOUTS_API_TOKEN` como secreto de InsForge; el flag de activación será una
  variable no secreta leída por la función. Nunca se inyecta ninguna de las dos variables al build
  estático.
- Entrada estricta: rechazar parámetros desconocidos o repetidos, códigos IATA inválidos, meses
  fuera del intervalo y precios máximos que no sean finitos o estén fuera de `(0, 100000]` EUR.
- Petición saliente fija a `api.travelpayouts.com`; token solo en `X-Access-Token`; timeout acotado,
  sin redirecciones y límite de tamaño del cuerpo. Nunca devolver cuerpo ni detalles del proveedor.
- Respuesta con contrato normalizado y errores genéricos; CORS limitado al origen de producción y
  a los orígenes locales requeridos. `OPTIONS` y métodos no permitidos se resuelven explícitamente.
- No añadir persistencia ni tablas nuevas para la primera versión. La UI aplica cooldown para evitar
  consultas accidentales repetidas; los límites de cuenta del proveedor siguen siendo el límite
  operativo. Si se necesita cuota resistente a llamadas directas o coordinación global, se diseña
  por separado con un almacenamiento atómico y límites aprobados.
- Precios de Data API son datos almacenados por el proveedor, no precios en vivo. No prometer ahorro,
  disponibilidad ni atribución de afiliado. Mostrar «precio orientativo» y la antigüedad de cada dato.

## Despliegue y operación

- El workflow estático de Cloudflare no cambia ni despliega el backend de InsForge.
- Versionar el código fuente de la función en el repo y documentar despliegue por CLI de InsForge.
  El secreto se configura en el backend fuera del código. El PR no ejecuta despliegues de producción.
- La variable `TRAVELPAYOUTS_ENABLED` de GitHub Actions no habilita por sí sola la función de
  InsForge. El procedimiento de activación indicará dónde configurar el flag backend y cómo
  verificar que la función está activa.
- No ejecutar llamadas reales en tests. Usar respuestas ficticias y comprobar auth, validación,
  timeout, errores del proveedor, sanitización y expiración de resultados.

## Fuera de alcance

- Aprobación del proyecto/programa Travelpayouts, emisión de enlaces de afiliado o confirmación de
  las condiciones comerciales.
- Búsqueda en vivo, reserva, comparación exhaustiva de rutas, conversión de moneda, creación
  automática de viajes, persistencia de consultas o promoción de otros programas de afiliados.
- Despliegue del backend o publicación de Cloudflare antes de integrar y aprobar el cambio.

## Criterios de aceptación

- Un visitante no autenticado no puede consultar Travelpayouts.
- El token solo existe en el backend de InsForge; ninguna respuesta o recurso estático lo contiene.
- La llamada soporta el contrato de entrada y la normalización indicados; fallos no filtran datos
  del proveedor ni rompen la alternativa manual.
- `/travel-inspiration` carga directamente en el export publicado y no coincide con las reglas
  existentes de `public/_redirects`.
- «Planear este viaje» abre el formulario actual con los datos sugeridos y no guarda sin envío
  explícito del usuario.
- Las pruebas de la función e interfaz usan proveedores falsos; el flujo de CI existente conserva
  el artefacto y despliegue assets-only de Cloudflare.
