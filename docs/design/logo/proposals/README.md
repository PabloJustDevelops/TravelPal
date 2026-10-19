# TravelPal · seis conceptos de logo

18 de octubre de 2026. Propuestas para elegir dirección; ninguna sustituye el icono de la app.

La hoja de contactos está en [index.html](index.html), autocontenida, sin JavaScript,
CDN, fuentes remotas ni imágenes enlazadas. Puede abrirse como fichero local.
El inventario completo de rutas y huellas está en [MANIFEST.sha256](MANIFEST.sha256).
Muestra los SVG inline para que `currentColor` herede del contexto; cargar una marca
con `<img>` no transmite el color del documento anfitrión.

## Criterio común

Base documental: `DESIGN.md`, ADR-008 y el README de las propuestas de interior
Atlas del 16 de octubre. Las diez maquetas PNG se han localizado, pero **no se han
inspeccionado visualmente**, conforme al brief. No se presupone que sus marcas
anteriores sean válidas para esta entrega: se sustituye esa dirección de logo.

- Lienzo de marca `viewBox="0 0 64 64"`, retícula base de 4 unidades con ajustes
  ópticos explícitos. Trazos de 6 u 8 unidades (1,5 o 2 px nominales a 16 px).
  Ninguna marca contiene texto visible, fuentes, raster, sombras ni degradados.
- Marcas separadas: solo geometría con `currentColor`, sin color literal. El
  contexto decide la tinta. Los lockups usan accent e ink de cada tema, sin fondo.
  En los SVG independientes, `prefers-color-scheme` adapta la paleta; en la hoja,
  ambos temas están fijados explícitamente y se comparan al mismo tiempo.
- Claro: accent `#0759d3`, ink `#101828`, paper `#ffffff`.
  Oscuro: accent `#8dbaff`, ink `#edf3fb`, paper `#101827`.
  No se añade un tono cálido: esa cualidad se busca en el dibujo y la metáfora.
- Wordmark editable: Inter SemiBold, peso 600, tamaño 36, tracking −0,7 unidades;
  ajustes por pareja en `dx`. Kerning y ligaduras automáticos desactivados para
  mantener la misma composición al convertir a trazados. Nombre escrito TravelPal.
- La versión final **debe convertirse a trazados antes de usarse como icono de app
  o favicon**. Se entregan ya los seis `-outlined.svg` con el wordmark convertido
  usando fontTools y la Inter SemiBold instalada (peso OS/2 600). Las marcas
  `-mark.svg` ya son geometría sin fuentes y son el punto de partida de esos iconos;
  el lockup horizontal no se recomienda como favicon. Los trazos geométricos SVG
  siguen siendo strokes donde corresponde; «outlined» se refiere al texto.
- Legibilidad y equilibrio son objetivos de construcción, **no una validación
  visual realizada**. La revisión humana a 16 px es el bloqueo para elegir una
  marca definitiva. Tampoco se ha comprobado exclusividad o similitud registral.

## Conceptos

### 01 · Cuaderno abierto

Cada viaje tiene sus páginas.

- Se apoya en: Dos páginas, un lomo y un borde superior curvo; el cuaderno editorial de Atlas.
- Resuelve: Acoge itinerario, reservas, tareas, notas y gastos bajo una metáfora de organización personal.
- Se rompe en: Puede parecer una app de lectura o educación. A 16 px las curvas del papel se simplifican; hay que juzgar si conserva personalidad.
- Construcción: Retícula de 4 unidades; trazo 6, terminales redondos. Lomo x=32; bordes x=8 y 56. Curvas ópticas en y=12–18 y 44–50.
- Ficheros: [lockup](01-cuaderno-abierto.svg), [marca](01-cuaderno-abierto-mark.svg), [wordmark en trazados](01-cuaderno-abierto-outlined.svg).

### 02 · Etapas

Un viaje avanza, una etapa cada vez.

- Se apoya en: Un solo recorrido en tres renglones; combina agenda y desplazamiento sin representar un medio de transporte.
- Resuelve: Hace visible la secuencia de días y planes con una silueta continua y abierta.
- Se rompe en: Puede leerse como una S o como una marca de transporte. Representa mejor el itinerario que el diario o el presupuesto.
- Construcción: Ejes y=12, 32 y 52; separación 20. Giros de radio 10, trazo 8 y extremos redondos; márgenes mínimos de 8 unidades.
- Ficheros: [lockup](02-etapas.svg), [marca](02-etapas-mark.svg), [wordmark en trazados](02-etapas-outlined.svg).

### 03 · Ligadura TP

Las iniciales comparten un mismo gesto.

- Se apoya en: T y P construidas a mano sobre un asta común; no son glifos de una fuente.
- Resuelve: Da una abreviatura propia al nombre y evita depender de un pictograma turístico. El asta sólida tiene 8 unidades.
- Se rompe en: La ligadura puede leerse solo como P. No explica viajes por sí misma y necesita acompañarse del nombre al presentar la marca.
- Construcción: Módulo de 4; asta x=24–32, barra y=12–20. Panza exterior hasta x=56; contraforma de 16 × 16 con curvas de radio 8.
- Ficheros: [lockup](03-ligadura-tp.svg), [marca](03-ligadura-tp-mark.svg), [wordmark en trazados](03-ligadura-tp-outlined.svg).

### 04 · Umbral

Preparar el viaje es abrir una puerta.

- Se apoya en: Arco de medio punto y umbral desplazado; alusión sobria a la arquitectura mediterránea de la dirección Atlas.
- Resuelve: Aporta una asociación con el destino y una silueta cálida sin ilustración, paisaje ni detalles de postal.
- Se rompe en: Puede confundirse con arquitectura, alojamientos o una n. El vínculo con tareas y gastos es más emocional que funcional.
- Construcción: Centro del arco (32,32), radio 20 y trazo 8. Apoyos en y=52; umbral desde x=28 hasta x=52.
- Ficheros: [lockup](04-umbral.svg), [marca](04-umbral-mark.svg), [wordmark en trazados](04-umbral-outlined.svg).

### 05 · Pliegue

Todo el viaje cabe en un desplegable.

- Se apoya en: Tres paneles de un mapa plegado; el propio contorno forma los pliegues, sin pin ni cuadrícula geográfica.
- Resuelve: Relaciona el objeto de papel de Atlas con la consulta de planes y documentos durante el viaje.
- Se rompe en: Se acerca al icono habitual de mapas. Los dos pliegues suman densidad a 16 px; no añadir calles, letras ni marcadores.
- Construcción: Paneles de 16 unidades entre x=8,24,40,56. Desfase vertical 8, trazo 6, uniones redondas. Contraespacios horizontales de 10 unidades.
- Ficheros: [lockup](05-pliegue.svg), [marca](05-pliegue-mark.svg), [wordmark en trazados](05-pliegue-outlined.svg).

### 06 · Vínculo

Un compañero mantiene las piezas unidas.

- Se apoya en: Dos eslabones abiertos en diagonal: el «Pal» del nombre entendido como ayuda personal, no como promesa de colaboración.
- Resuelve: Expresa continuidad entre reservas, planes y recuerdos. Usa la relación entre piezas en vez de un objeto turístico.
- Se rompe en: El eslabón es común en apps de enlaces e integraciones. Los cruces diagonales necesitan revisión humana a 16 px.
- Construcción: Retícula de 4 con ajustes de 2 unidades; curvas Bézier simétricas, trazo 6 y diagonales a 45 grados. Aperturas opuestas, sin máscaras ni superposiciones de otro color.
- Ficheros: [lockup](06-vinculo.svg), [marca](06-vinculo-mark.svg), [wordmark en trazados](06-vinculo-outlined.svg).

## Cómo leer las pruebas

[renders/](renders/) contiene cada SVG a 16, 32, 64 y 128 px **de alto**, manteniendo
proporciones: las marcas son cuadradas y los lockups siguen siendo horizontales.
Los PNG principales son de fondo transparente con paleta clara. También hay
pruebas de todos los SVG en oscuro sobre paper oscuro, y de cada marca en una sola
tinta sobre ambos papeles. No se fuerza el lockup a un cuadrado deformado.

[VERIFICATION.md](VERIFICATION.md) registra comandos, salidas literales y códigos
reales de retorno: rasterización, dimensiones, XML, colores, recursos externos,
ausencia de texto en marcas y alcance de Git. Los comandos inspeccionan los
artefactos; las medidas de píxeles no sustituyen una revisión visual.

El único literal con `http` de los SVG es el namespace estándar de SVG. Es una
identificación XML, no una dependencia ni una petición de red; eliminarlo rompe
la interpretación de un SVG independiente. La auditoría lo cuenta por separado y
rechaza cualquier otra referencia. Todos los enlaces de la hoja son relativos.

## Recomendación

**01 · Cuaderno abierto** es el primer candidato: enlaza directamente con el papel
editorial de Atlas y contiene todas las funciones de un viaje sin centrarse en el
vuelo. El lomo y las dos páginas permiten una silueta económica y una sola tinta.
Su debilidad es la asociación con lectura: la elección depende de que el contexto
TravelPal y el wordmark compensen esa ambigüedad.

**03 · Ligadura TP** es el segundo: la forma llena y la contraforma amplia ofrecen
una alternativa más compacta para la app. Trabaja con las iniciales propias en vez
de un objeto turístico compartido por muchas marcas. Pierde capacidad narrativa,
pero complementa bien una interfaz e ilustraciones que ya cuentan el viaje.

La recomendación se basa en adecuación al brief y geometría; queda pendiente
comparar los renders a tamaño real y confirmar la legibilidad con una persona.
