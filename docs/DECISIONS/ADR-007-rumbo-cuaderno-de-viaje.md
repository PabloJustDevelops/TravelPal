# ADR-007: El rumbo visual es "Cuaderno de viaje" y se implanta por tokens

## Contexto

El sistema de diseño acababa de cerrarse cuando se escribieron tres direcciones para la piel de la
app (`docs/DESIGN-DIRECTIONS.md`): **A, Cuaderno de viaje** (editorial, cálida); **B, Sala de
control** (utilitaria, densa); **C, Tarjeta postal** (escaparate, consumidor). El documento no
decidía: proponía, y recomendaba la C por coste.

Lo que había, medido sobre el árbol:

- **Tokens**: solo `--background` y `--foreground`. Todo lo demás eran utilidades crudas de
  Tailwind escritas en el componente.
- **Uso crudo de color**: **904 usos** de utilidades de paleta (`bg-*`, `text-*`, `border-*` de
  `gray`, `blue`, `red`, `green`, `yellow` y las familias de categoría) repartidos en **71
  ficheros**. Cualquier dirección que se aplique pantalla a pantalla es un barrido de esa
  magnitud.
- **Tipografía**: Inter, declarada una sola vez en `layout.tsx` con `next/font`.
- **Modo oscuro**: **9 de 22 páginas** con clases `dark:` propias y **13 sin ellas**; el armazón
  usaba `dark:bg-black` mientras tarjeta, modal y aviso usaban `dark:bg-gray-800`. No había escala
  de superficies: había dos decisiones distintas conviviendo.
- **Guardia**: `src/__tests__/design-system.test.ts` fija el contrato (un spinner, una clase de
  campo, un botón primario, una librería de iconos, una tipografía) y además lo ata a los
  **valores**: exige que `bg-blue-600` + `hover:bg-blue-700` solo exista en `Button.tsx`.

Dos hechos más condicionan la decisión:

1. **Hay un rework funcional completo sobre la mesa.** No se sabe qué pantallas sobreviven, así que
   gastar esfuerzo pintándolas una a una es invertir en lo que puede desaparecer.
2. **La primera impresión del producto es la landing**, que hoy es una plantilla oscura con
   degradado, tarjetas redondeadas y sombras: lo contrario del rumbo editorial.

## Decisión

Se implanta la dirección **A, Cuaderno de viaje**, y se implanta **en la capa de fundamentos**
(tokens, componentes compartidos y armazón), no pantalla por pantalla. Lo que se decide:

1. **Paleta en tres capas dentro de `globals.css`.** (1) Paleta cruda en `:root` y `.dark`: papel
   `#FBF8F3`, superficie `#F3EDE3`, tinta `#1A1815`, secundario `#6A645B`, línea `#E4DCD0`, acento
   `#AC4F09` y los tres estados (éxito `#2E6D5C`, aviso `#8D5606`, error `#9F1239`). Secundario,
   acento, éxito y aviso son un punto más oscuros que los valores originales del rumbo, el ajuste
   mínimo para que sus pares de texto superen 4.5:1 (lo vigilan los e2e con axe). (2) Tokens
   semánticos en `@theme inline` (`background`, `surface`, `line`, `ink`, `muted`, `accent`,
   `accent-hover`, `accent-soft`, `on-accent`, `success`, `warning`, `danger`) más radios de lámina
   (2–4px), escala de espaciado por secciones (3rem / 5rem), escala tipográfica editorial y escala
   de lectura 1,6. (3) **Alias de compatibilidad**: se redefinen las escalas crudas de Tailwind
   (`gray`, `blue`, `red`, `green`, `yellow`) con la paleta del rumbo, de modo que los 904 usos
   crudos heredan la dirección sin repintar pantalla por pantalla.

2. **Tipografía en un solo import.** Se añade la serif de titulares (`Fraunces`) **en la misma
   importación de `next/font`** que Inter, según el aviso del propio documento de rumbos: una
   segunda importación rompe el contrato. El texto sigue en Inter sobre el `<body>`; la serif se
   expone como variable y `globals.css` la resuelve en `font-serif`, de forma que ningún componente
   declara familias.

3. **Componentes compartidos como láminas.** Botón, campo, tarjeta, cabeceras, estados vacío y de
   error, aviso, spinner, modal y esqueleto de página dejan de pedir color por escala cruda y lo
   piden por token. La tarjeta pierde borde y sombra y usa un filete de 1px como separador que se
   concentra en la clase de acción primaria; los enlaces que actúan como botón (landing, CTA) se
   apoyan en esa misma clase en vez de copiar el acento.

4. **Armazón y landing.** Barra y layout del panel sobre papel con filete; la barra del panel pierde
   el degradado, el logo en degradado y el grupo de pastillas flotantes. La landing pasa a portada a
   sangre con velo plano (sin degradado), titulares en serif, ritmo de secciones por token, sin
   elevación y sin `hover:scale`.

5. **Modo oscuro: claro primero.** El oscuro no es una piel distinta, es el **inverso literal del
   papel** (fondo `#14120F`, superficie `#1E1B16`, tinta `#EFE9DE`, línea `#332E26`, acento
   `#E8A33D`) y se resuelve entero por tokens, así que el armazón y los componentes compartidos
   cambian de modo sin que ninguna pantalla declare su propio `dark:`. Se añade `color-scheme` por
   modo y el tema se aplica antes del primer pintado (sin fogonazo claro).

6. **La guardia se actualiza con criterio, no se esquiva.** Es un contrato: cambia el acento, luego
   cambian los dos asserts que lo fijaban. Se reescriben para apuntar a la clase compartida
   (`actionStyles.ts`) y al campo, se añade el requisito de que botón y enlaces se apoyen en esa
   clase, y se añade un bloque nuevo que fija el rumbo: la paleta vive en tokens en claro **y** en
   oscuro, `color-scheme` de los dos modos, el tema antes del pintado, la serif por variable y que
   los componentes compartidos no vuelvan a la escala cruda.

**Fuera de alcance de esta decisión:** repintar páginas y componentes de dominio. Los 904 usos
crudos de página siguen ahí; lo que cambia es que ahora resuelven a la paleta del rumbo.

### Alternativas consideradas

- **Dirección C, Tarjeta postal** (la que recomendaba el documento de rumbos). Descartada: es
  barata y vende bien el destino, pero es una piel de escaparate con tres niveles de sombra y
  radios de 16px, y el objetivo declarado pasó a ser *diferenciación de marca*, no coste.
- **Dirección B, Sala de control**. Descartada: es una herramienta excelente y un mal escaparate, y
  renuncia explícitamente a vender; la landing es hoy el escaparate del producto.
- **Barrido de los 904 usos, fichero a fichero.** Descartada por coste y por riesgo: con un rework
  funcional pendiente, parte de ese trabajo se tira. El alias de escalas consigue el mismo efecto
  visual a una fracción del coste, y deja el barrido para cuando se sepa qué pantallas viven.
- **Eliminar el modo oscuro** en lugar de resolverlo. Descartada: quitar una preferencia del
  usuario es una decisión de producto, y el inverso del papel es la mitad de coherente que el
  claro. Se mantiene la preferencia y se define su comportamiento.
- **Sustituir Inter por la serif** o declarar una segunda importación de fuentes. Descartada de
  raíz: rompe el contrato de tipografía y empeora la lectura de las tablas de gastos.

## Consecuencias

Positivas:

- El rumbo llega a **toda** la app (los 904 usos crudos resuelven a la paleta nueva) sin repintar
  una sola pantalla. Verificado en el CSS compilado: no queda ningún valor por defecto de Tailwind
  de las escalas redefinidas.
- El código nuevo pide color por nombre (`bg-surface`, `text-ink`, `border-line`, `bg-accent`), así
  que el siguiente cambio de acento o de papel se hace en un sitio.
- El modo oscuro deja de tener dos verdades: armazón, componentes y controles nativos acompañan al
  modo elegido y no hay fogonazo al cargar.
- La guardia ahora protege el rumbo, no solo la forma.

Negativas y deuda asumida:

- **Las escalas crudas de Tailwind ya no significan lo que su nombre dice**: `blue-600` es el acento
  del rumbo, no un azul. Queda documentado en `globals.css`; el código nuevo no debe usarlas.
- **Queda asimetría de pantalla**: varias páginas llevan utilidades sueltas (`bg-white`, `dark:*`)
  que no son del sistema. Se corrigen o desaparecen con el rework funcional (ver la spec de rework
  funcional), no en esta decisión.
- Las familias de color **categóricas** (violeta, naranja, rosa, índigo, esmeralda) y los hex fijos
  de las gráficas **no** se tocan: son código de datos, no cromo. Quedan como candidatas a una
  rampa propia si el rework conserva analítica y gastos.
- Un cambio de paleta exige ahora actualizar la guardia en el mismo commit. Es intencionado.

## Estado

Aprobado
