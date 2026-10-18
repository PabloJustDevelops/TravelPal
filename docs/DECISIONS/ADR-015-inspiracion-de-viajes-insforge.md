# ADR-015: Inspiración de viajes mediante función de InsForge

## Contexto

TravelPal se publica como export estático de Next.js servido por un Worker assets-only de Cloudflare.
El Worker no ejecuta un servidor Next.js ni Route Handlers. La sesión de usuario ya está disponible
en el navegador mediante el SDK de InsForge. Las consultas de inspiración necesitan además proteger
la credencial privada de Travelpayouts y validar la sesión antes de usarla.

## Decisión

- Publicar `/travel-inspiration` como una ruta estática y llamar a la función de InsForge
  `travel-inspiration` mediante `insforge.functions.invoke`.
- La función verifica el bearer de sesión con InsForge y es la única pieza que lee
  `TRAVELPAYOUTS_API_TOKEN`, guardado como secreto de función. `TRAVELPAYOUTS_ENABLED` se configura
  en el entorno de esa función.
- Mantener el Worker de Cloudflare como assets-only y el export estático como artefacto de
  publicación. **No añadir Route Handlers de Next.js ni un servidor de aplicación al Worker.**
- Empaquetar la función con Deno y desplegar su slug mediante la CLI de InsForge, de forma separada
  del workflow de publicación del sitio.
- Tratar las pruebas con respuestas ficticias como verificación de contrato y comportamiento, no
  como validación del proveedor real. La aprobación del proyecto/programa en Travelpayouts es
  externa y queda pendiente del propietario.

## Consecuencias

- La credencial de Travelpayouts no forma parte del cliente, el export estático ni la configuración
  del Worker.
- La página puede existir y superar las verificaciones locales antes del alta externa; las llamadas
  reales seguirán bloqueadas hasta que el propietario complete el alta y aprobación, configure el
  secreto y el flag, y despliegue la función activa en InsForge.
- No se ha creado una cuenta de Travelpayouts, configurado credenciales ni desplegado la función.
  Por tanto, este ADR registra la arquitectura elegida, no una integración verificada con el
  proveedor.

## Estado

Aprobado como decisión de arquitectura; operación con el proveedor pendiente del propietario.
