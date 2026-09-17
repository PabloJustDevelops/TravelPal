# ADR-005: La web no cargaba por las variables públicas no inlineadas, no por la compresión

## Contexto

La web dejó de cargar en cualquier navegador (página de error del navegador, y
por debajo la página `__next_error__` de Next), mientras que `curl` recibía 200
con el HTML correcto. La investigación inicial atribuyó el fallo a la
compresión: pidiendo con cabecera de navegador (`Accept-Encoding: gzip, deflate,
br, zstd`) la respuesta traía `Content-Encoding: zstd`. De ahí salieron dos
"arreglos": `compress: false` en `next.config.js` (`ba609f4`) y un
`Cache-Control: no-transform` escrito desde `src/proxy.ts`.

## Decisión

El diagnóstico era falso. Se descartan ambos cambios y se documenta por qué:

- El zstd que sirve el borde es **válido**: 8667 B decodifican exactamente a los
  mismos 37456 B del HTML sin comprimir (comparación byte a byte, Node zlib).
- Sirviendo **todas** las respuestas sin comprimir (proxy inverso local que
  elimina `Accept-Encoding` en cada petición, reescribiendo el origen), el
  navegador falla exactamente igual, con la misma excepción.
- Con `compress: false` ya desplegado, el borde sigue enviando zstd: la opción
  `compress` de Next sólo afecta al servidor Node, no al Worker de Cloudflare.

La causa real era otra: `src/lib/public-env.ts` validaba el objeto
`process.env` completo. El bundler sólo sustituye los accesos **estáticos**
(`process.env.NEXT_PUBLIC_X`); el objeto entero llega `{}` al navegador, la
validación zod lanzaba durante la evaluación del módulo y tumbaba todo módulo
que importa `publicEnv` (cliente de InsForge, logger, auth). Se corrige
enumerando cada variable pública con acceso estático.

`no-transform` **sí** impide que Cloudflare comprima (verificado en una versión
de preview: la respuesta pierde `Content-Encoding`), pero es innecesario para
este fallo, desactiva la compresión del HTML y sobrescribe el `Cache-Control:
s-maxage` de la ruta. No se usa.

## Consecuencias

- Se mantiene la compresión del borde (zstd/brotli/gzip según
  `Accept-Encoding`); es correcta y no impide que el navegador renderice.
- Ante un síntoma "la web no carga en el navegador pero `curl` recibe 200",
  sospechar primero del bundle cliente (excepciones al evaluar módulos) y no de
  la compresión: `curl` no ejecuta JavaScript, un navegador sí.
- `compress: false` no hace nada en el Worker; no volver a proponerlo como
  arreglo de hosting.
- Al leer variables `NEXT_PUBLIC_*` en código que se ejecuta en el cliente, usar
  siempre acceso estático; nunca pasar `process.env` como objeto.

## Estado

Aprobado
