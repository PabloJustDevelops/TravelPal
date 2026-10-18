# Operación: inspiración de vuelos

La página estática `/travel-inspiration` consulta la función de InsForge con la sesión del usuario.
La función `travel-inspiration` verifica esa sesión antes de llamar a Travelpayouts Data API. La
aplicación y el Worker de Cloudflare no reciben el token de Travelpayouts.

## Estado actual y bloqueos

- **No se ha creado una cuenta de Travelpayouts ni se ha desplegado la función de InsForge.** No se
  han configurado secretos ni se ha llamado al proveedor real.
- Todas las pruebas y verificaciones de este cambio usan respuestas ficticias del proveedor. No
  demuestran que la credencial, la API ni los enlaces funcionen con una cuenta real.
- La aprobación del proyecto/programa en Travelpayouts es externa y sigue pendiente del propietario.
  Hasta que el propietario complete el alta y obtenga la aprobación, quedan bloqueados las llamadas
  reales, la comprobación de disponibilidad de datos y la validación de cualquier uso o atribución de
  enlaces de afiliado.
- Después del alta externa también hace falta que el propietario configure el secreto y el flag en
  InsForge y despliegue la función. Hasta entonces la interfaz no puede consultar datos reales.

## Alta y configuración en InsForge

Completar estos pasos solo después de que el propietario haya creado y aprobado el proyecto/programa
en Travelpayouts:

1. En el proyecto de InsForge `travelpal`, guardar `TRAVELPAYOUTS_API_TOKEN` como **secreto de la
   función**. No añadirlo a GitHub Actions, `.env.local`, el código, el bundle estático ni al entorno
   de Cloudflare. No copiarlo en logs o capturas.
2. En la configuración de entorno de la función de InsForge, establecer
   `TRAVELPAYOUTS_ENABLED=true`. Este flag no es un secreto. El valor en GitHub Actions no cambia
   el entorno de InsForge.
3. Desde la raíz del repo, con Deno 2.9.7 y el proyecto de InsForge correcto enlazado en la CLI,
   crear la configuración Deno temporal y empaquetar las dependencias locales en un único archivo.
   El import npm del SDK queda externo para Deno Subhosting:

   ```bash
   tmpdir="$(mktemp -d)"
   printf '%s\n' '{"imports":{"zod":"npm:zod@4.1.12"},"compilerOptions":{"lib":["deno.window","deno.ns","dom"],"strict":true}}' > "$tmpdir/deno.json"
   deno bundle --config "$tmpdir/deno.json" --no-lock --platform deno --packages bundle --output "$tmpdir/travel-inspiration.js" --external="npm:@insforge/sdk" insforge/functions/travel-inspiration/index.ts
   ```

4. Desplegar el slug `travel-inspiration` con el archivo empaquetado:

   ```bash
   npx -y @insforge/cli functions deploy travel-inspiration --file "$tmpdir/travel-inspiration.js"
   ```

5. Confirmar el estado en la lista de funciones:

   ```bash
   npx -y @insforge/cli functions list
   ```

   Continuar solo si `travel-inspiration` aparece con estado `active`. Un estado `draft` o `error`
   requiere resolver el despliegue antes de habilitar el uso.
6. Cuando el despliegue y la comprobación terminen, borrar solo el directorio temporal creado en el
   paso 3: `rm -rf "$tmpdir"`.

El secreto debe cargarse en el gestor de secretos de InsForge, no como argumento versionado ni como
variable de build. La CLI también permite crear secretos, pero el valor nunca debe escribirse en
este documento, en el historial del shell compartido ni en la salida de comandos.

## Comprobación manual autenticada

Cuando el propietario haya completado el alta, la aprobación, la configuración y el despliegue:

1. Iniciar sesión en TravelPal y abrir directamente `/travel-inspiration`.
2. Confirmar que la comprobación inicial muestra el estado disponible y que una consulta válida
   muestra resultados o el estado vacío esperado.
3. Abrir «Planear este viaje» y verificar que `/create-trip` presenta origen, destino y fechas como
   valores editables. Guardar solo después de pulsar explícitamente el botón del formulario.
4. Si falla, revisar el estado `active` y la configuración de la función en InsForge. No imprimir ni
   copiar el bearer de sesión, el secreto de Travelpayouts ni cabeceras de autorización en logs.

Los precios son orientativos y pueden estar almacenados por el proveedor; no equivalen a una búsqueda
en vivo ni garantizan disponibilidad. Esta comprobación manual todavía no se ha ejecutado contra
Travelpayouts real.

## Hosting

`/travel-inspiration` se exporta como HTML estático y el Worker de Cloudflare sigue siendo assets-only.
No se añaden Route Handlers de Next.js ni lógica de aplicación al Worker. El workflow de Cloudflare
no despliega la función ni configura sus variables; esas operaciones pertenecen al proyecto de
InsForge.
