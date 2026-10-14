# 🎨 Rumbos visuales

> Comparación histórica anterior a Atlas. ADR-007 fue sustituido por
> [ADR-008](DECISIONS/ADR-008-atlas-claro.md). Las descripciones de tokens y pantallas
> de este documento reflejan aquel punto de partida, no el código actual.
> La guía vigente para continuar el diseño está en [DESIGN.md](../DESIGN.md).

## De dónde partimos

El sistema acaba de cerrarse. Lo que hay hoy, y que condiciona las tres direcciones:

| Pieza | Estado actual |
|---|---|
| Tokens | Solo `--background` y `--foreground`. **No hay escala de color propia**: cada color es una utilidad cruda de Tailwind escrita en el componente (`gray-*`, `blue-600`, `red-600`). |
| Tipografía | **Inter**, declarada una sola vez en `src/app/layout.tsx` con `next/font`. |
| Piel | Tarjetas `rounded-lg` con borde 1px y `shadow-sm`; radios pequeños; un único acento azul (`blue-600`). |
| Modo oscuro | Clase `.dark`, resuelto en `ThemeContext`. **9 de 22 páginas** tienen clases `dark:` propias; las 13 restantes solo heredan lo que traigan sus componentes. |
| Guardia | `src/__tests__/design-system.test.ts` fija el contrato: un spinner, una clase de campo, un botón primario, una librería de iconos, una tipografía. |

Dos consecuencias que valen para las tres direcciones:

- **La guardia está atada a los valores, no solo a la forma.** El test exige que la lista de ficheros con la línea `bg-blue-600` + `hover:bg-blue-700` sea exactamente `["src/components/ui/Button.tsx"]`. Cambiar el acento obliga a editar el test *a la vez* que el botón, no después.
- **La tipografía pasa por un cuello de botella.** El test exige **una sola** importación de `next/font/google` y que el `<body>` siga llevando `inter.className`. Añadir una fuente de titulares vale si va en la misma línea de import; **sustituir** Inter rompe el contrato.

Cifra de apoyo: hay **242 usos** de utilidades de superficie (`bg-blue-*`, `text-blue-*`, `border-blue-*`, `rounded-*`, `shadow-*`) repartidos en **58 ficheros**. Eso es lo que hay que barrer en cualquier dirección.

---

## Dirección A — Cuaderno de viaje

*(editorial, cálida)*

**La idea.** La app se lee como una revista de viajes: el contenido manda y la interfaz casi desaparece, con blancos amplios y jerarquía tipográfica fuerte. El viaje deja de ser un registro y pasa a ser una historia que apetece enseñar.

**Tipografía.** Dos familias: un serif de titulares (Fraunces o Newsreader) con cuerpo de texto en Inter. Escala generosa — títulos de 32–40px, interlineado 1.6, medida de lectura de 65–75 caracteres, sin tracking negativo.

**Paleta.**

| Uso | Claro | Oscuro |
|---|---|---|
| Papel / fondo | `#FBF8F3` | `#14120F` |
| Superficie | `#F3EDE3` | `#1E1B16` |
| Tinta | `#1A1815` | `#EFE9DE` |
| Texto secundario | `#6B655C` | `#B9B0A2` |
| Línea | `#E4DCD0` | `#332E26` |
| Acento (acción) | `#B45309` | `#E8A33D` |
| Éxito / aviso / error | `#2F6F5E` / `#A16207` / `#9F1239` | `#4E9C86` / `#C99A2E` / `#C7546B` |

**Espacio y tarjetas.** El espacio es el material: 48–80px de padding entre secciones. Las tarjetas son **láminas**, no cajas: sin borde, sin sombra, con un filete de 1px como separador y radio de 2–4px. Las portadas sangran de borde a borde. Sin gradientes y sin elevación en hover; el movimiento se reserva para el contenido que entra.

**Referencia real.** [Condé Nast Traveler](https://www.cntraveler.com) — editorial de viajes de gama alta, tipografía serif y fotografía a sangre. Como referencia de tono de marca, [Away](https://www.awaytravel.com), que vende objeto y relato a la vez.

---

## Dirección B — Sala de control

*(utilitaria, precisa)*

**La idea.** Interfaz densa y precisa, casi de herramienta de ingeniería: la jerarquía se construye con peso y color, no con tamaño. La app presume de rapidez y de que ningún dato estorba, no de fotos bonitas.

**Tipografía.** Inter en exclusiva (ya está montada), tracking de −0.011em, escala compacta: 12 / 13 / 14 / 20px. Los títulos no son grandes, son **oscuros y en negrita**.

**Paleta.**

| Uso | Claro | Oscuro |
|---|---|---|
| Fondo | `#FFFFFF` | `#08090A` |
| Superficie | `#F7F8F8` | `#101113` |
| Superficie 2 | `#EEF0F1` | `#17181B` |
| Tinta | `#08090A` | `#F7F8F8` |
| Secundario / terciario | `#6F7680` / `#8A8F98` | `#9BA1AA` / `#6F7680` |
| Línea | `#E4E6EA` | `#23252A` |
| Acento | `#5E6AD2` | `#7C86E0` |
| Éxito / aviso / error | `#3E9B4F` / `#C08A00` / `#C52828` | `#4FB463` / `#D9A01C` / `#E05A5A` |

**Espacio y tarjetas.** Densidad alta: filas de 32–36px, padding de 12–16px, radios de 6–8px. Sombra **solo** en lo que flota (modales, menús); en reposo, borde de 1px y fondo ligeramente distinto. Listas y tablas por delante de rejillas de tarjetas. El modo oscuro no es un extra: es donde esta dirección respira.

**Referencia real.** [Linear](https://linear.app) — la interfaz y su documentación pública son el patrón de referencia de "denso pero legible" (contraste medido, un único acento, movimiento mínimo).

---

## Dirección C — Tarjeta postal

*(escaparate, consumidor)*

**La idea.** Fotografía grande, tarjetas redondeadas y color cálido: es la dirección que mejor vende el destino. La parte de gestión sigue ahí, pero cada viaje gana una portada que da ganas de compartir.

**Tipografía.** Inter para todo (400/500/600), con la opción de un display propio para titulares. Títulos de 24–30px en 600, sin llegar al serif.

**Paleta.**

| Uso | Claro | Oscuro |
|---|---|---|
| Fondo | `#FFFFFF` | `#121212` |
| Superficie | `#F7F7F7` | `#1E1E1E` |
| Tinta | `#222222` | `#EDEDED` |
| Secundario | `#717171` | `#A8A8A8` |
| Línea | `#DDDDDD` | `#2E2E2E` |
| Acento | `#FF5A5F` | `#FF7A7E` |
| Éxito / aviso / error | `#008489` / `#E0A800` / `#C13515` | `#22A0A6` / `#F0BE33` / `#E3725A` |

Si cambiar de acento ahora sale caro, la variante barata es **conservar el azul** y subirlo: `#2563EB` con `#1D4ED8` en hover, y un secundario teal `#008489`. Se pierde la mitad del carácter, no el escaparate.

**Espacio y tarjetas.** Radios grandes: 16px en tarjeta, 24px en modal y sección, 999px en chips. **Tres niveles de sombra** (reposo, hover, flotante) en vez de una. Tarjeta canónica: imagen 16:9 arriba, título, metadatos, y elevación al pasar el ratón. Ritmo regular de 8px, mucho aire pero predecible.

**Referencia real.** Airbnb y su Design Language System, documentado por quien lo diseñó: [Airbnb DLS — Karri Saarinen](https://karrisaarinen.com/dls/). Como referencia de *app* de viajes que es escaparate sin dejar de ser herramienta: [Flighty](https://flighty.com) (Apple Design Award).

---

## Cuál encaja y cuál recomiendo

**Encajan con "app de viajes que además quiere ser escaparate" la A y la C.** La B es una herramienta excelente y un mal escaparate: su mérito es que no molesta, y eso no se enseña en una captura.

**Recomiendo la C, Tarjeta postal.** Tres razones:

1. **Es la única que aguanta las dos caras del producto.** Un planificador tiene tablas de gastos, gráficas de analítica y un tablero de tareas: la B los trata bien y falla el escaparate; la A los trata mal (una tabla densa en serif y a 1.6 de interlineado se lee peor, no mejor). La C pone el escaparate donde toca —portadas, listados, landing— y deja el interior neutro.
2. **Es la más barata de las dos que valen.** Reutiliza Inter tal cual, la tarjeta `rounded-lg` existente y la estructura de `Button`: es un cambio de tokens y de radios, no de arquitectura. La A exige además un par tipográfico nuevo y rehacer la jerarquía de cada titular.
3. **Ya tenemos medio camino hecho.** Las 9 páginas con `dark:` y el `dark:bg-gray-800` de las tarjetas están más cerca de una superficie `#1E1E1E` que del papel `#14120F` y el `#1E1B16` de la A.

Si el objetivo fuera **diferenciación de marca por encima de coste**, elegiría la A: es la única que no se parece a nada del sector. Y si el objetivo fuera **eficiencia para un usuario que registra datos todos los días**, la B sería la respuesta correcta — pero entonces conviene renunciar explícitamente al escaparate.

---

## Qué habría que tocar, y cuánto

Ninguna dirección se lleva a la app con un cambio de `globals.css`. Orden de magnitud en trabajo de una persona:

### A — Cuaderno de viaje · **grande**

- `globals.css`: juego de tokens nuevo (papel, tinta, líneas, acentos) más los seis colores de estado.
- `layout.tsx`: añadir la fuente de titulares **en la misma importación** de `next/font/google` y conservar `inter.className`; si se sustituye Inter, hay que editar la guardia.
- `Button.tsx` y `fieldStyles.ts`: acento, radios y alturas. `Button.tsx` deja de contener `bg-blue-600` + `hover:bg-blue-700`, luego **la guardia falla y hay que reescribir ese assert**.
- `Card.tsx`: quitar borde y sombra, pasar a lámina. `PageTitle`, `EmptyState` y `ErrorState` heredan el cambio.
- Barrido de los **58 ficheros / 242 usos** de `rounded-*`, `shadow-*` y `gray-*`.
- Además: las 13 páginas sin `dark:` propias necesitan que la nueva paleta oscura llegue a sus superficies.

### B — Sala de control · **media**

- `globals.css`: escala de grises y superficies en `@theme inline` (por fin un token en vez de `gray-800` a mano), más densidad.
- `Button.tsx`, `fieldStyles.ts`, `Card.tsx`: radio 6–8, borde de 1px y sombra solo en lo flotante. Mismo aviso de guardia que en la A.
- `PageTitle` y los estados: bajar tamaños de titular.
- Densidad en `Calendar.tsx`, `TaskBoard.tsx` y las tablas de analítica y gastos.
- Modo oscuro ya a medio hacer: las 9 páginas con `dark:` no se tocan, las 13 restantes sí.

### C — Tarjeta postal · **media**

- `globals.css`: acento, escala de radios y **tres niveles de sombra** como tokens.
- `Button.tsx`, `fieldStyles.ts`: acento y radio. Mismo aviso de guardia: cambiar el acento rompe el assert del primario.
- `Card.tsx`: `rounded-2xl` y sombra de reposo. Arrastra a `PageSkeleton` y a las tarjetas por dominio (`TripCard`, `ExpenseCard`, `NoteCard`, `BudgetCard`, `BookingCard`, `AlertCard`).
- Unificar la asimetría existente: `DashboardLayout` usa `dark:bg-black` mientras `Card`/`Modal`/`Toast` usan `dark:bg-gray-800`; con una escala de superficies real esto se resuelve de una vez.
- La parte de escaparate —portada de viaje— pide un campo nuevo en `trips` y una migración; es lo único que sale del CSS.

En las tres, el orden sensato es el de la guardia: **tokens → átomos (`Button`, campo, `Card`) → estados y cabeceras → barrido de páginas**. Ese orden ya funcionó al cerrar el sistema actual.

## Estado

**Decidido.** La dirección elegida es la **A, Cuaderno de viaje**, registrada en
[ADR-007](DECISIONS/ADR-007-rumbo-cuaderno-de-viaje.md), que fija la paleta, la tipografía, los
componentes compartidos, el armazón y el comportamiento del modo oscuro. Este documento queda como
histórico: conserva las tres propuestas y su comparación, pero no se redecide. La recomendación de
la C que aparece arriba se descartó a favor de la diferenciación de marca.

## Referencias

- [Condé Nast Traveler](https://www.cntraveler.com) — editorial de viajes.
- [Away](https://www.awaytravel.com) — marca de viajes con relato editorial.
- [Linear](https://linear.app) — densidad y precisión de herramienta.
- [Airbnb DLS, por Karri Saarinen](https://karrisaarinen.com/dls/) — el sistema de diseño de Airbnb.
- [Flighty](https://flighty.com) — app de viajes escaparate (Apple Design Award).
