# Ilustraciones originales de TravelPal

Creación: 13 de octubre de 2026 con la herramienta integrada ImageGen. Son escenas ilustradas ficticias, no fotografías ni representaciones de destinos o usuarios reales. No se han utilizado fotos de stock ni referencias de terceros. El crédito visible es «Ilustración original creada para TravelPal con IA».

- `coastal-journey.webp`: 1536 × 1024, WebP calidad 82. Portada y panel de acceso. Alt: viajero por un sendero hacia un pueblo costero mediterráneo, con montañas y velero.
- `travel-notebook.webp`: 1024 × 1024, WebP calidad 82. Recurso conservado de la exploración visual; no se usa en la landing seleccionada. Alt: cuaderno de viaje con ruta dibujada, brújula y mapa sobre una mesa.

Los PNG originales se conservaron fuera del repositorio; los recursos web se codificaron con Sharp, sin metadatos del generador. Los componentes declaran dimensiones y `sizes`; solo la portada precarga su imagen.

## Prompts utilizados (herramienta integrada, sin API/CLI)

### Coastal journey

Use case: illustration-story. Asset type: original TravelPal website hero illustration, reused as auth artwork. Create a sophisticated editorial travel illustration in a wide 3:2 landscape format. A winding terracotta footpath leads from foreground Mediterranean dunes through a small warm ivory coastal village toward a deep muted teal sea, distant mountains and a pale apricot sun. A tiny traveler with a backpack walks the path, an understated sailboat on the sea, olive foliage in foreground. Travel atlas aesthetic, tactile cut paper and gouache textures, refined geometric scenery, restrained palette of warm ivory #f7f4ed, terracotta #c75b39, muted sea teal #397c79, ochre and ink navy. Strong layered composition, inviting atmosphere, crisp intentional shapes, high quality illustrated travel journal cover. Image only, no text, letters, logos, watermark, UI, borders, photo elements or stock photography. Landscape scene fills the canvas, light sky in upper third. This must be custom artwork, not a photograph.

### Travel notebook

Use case: illustration-story. Asset type: original TravelPal website illustration, square 1:1 composition. An overhead still life of a travel journal open on a pale cool neutral desk, simple hand-drawn coastline route with a dotted blue path on its unlined pages, a compass, a blue pen, a train ticket with abstract marks only, an olive branch and the corner of a folded soft blue map. Sophisticated gouache and cut-paper editorial illustration, tactile paper texture, light clean background, restrained ink navy, cobalt blue and sage green with tiny terracotta details. Bright natural light. Carefully composed travel planning objects, elegant and calming, full canvas. No readable text, letters, numbers, logos, watermark, UI, photographic elements or stock photography. Custom illustration for a travel planning app following the Atlas light direction.

## Panorámica del layout seleccionado

`coastal-panorama.webp`: 1774 × 887, 323360 bytes, WebP calidad 85 y alphaQuality 100. Derivada con ImageGen de la ilustración costera original y el mock seleccionado; conserva transparencia real en el cielo para integrarse con los tokens claros y oscuros.

Prompt: Edit the original TravelPal coastal illustration into a production hero raster asset matching the scenic layout in the selected website. Output ONLY the scenic artwork, NOT the webpage or any text/UI. Very wide panoramic landscape, approximately 2:1 aspect ratio. Preserve the original painterly gouache style, exact recognizable village, teal sea, mountains, sailboat, tiny backpack traveler and terracotta path. Recompose it like the selected website: village and traveler at lower left, sea at right, distant mountains rising toward the upper right. Remove all upper-left olive-tree branches that intrude into the heading area; retain lower-left foreground foliage. Remove the sky entirely to real alpha transparency, including upper-left area; preserve isolated apricot sun at upper right and any fine skyline edges. In the top-left 55 percent of canvas, leave a generous transparent region for a two-line website title. Scenic land/sea fills lower 45 percent edge to edge; right-hand mountains rise higher to around 45 percent of height. No text, letters, labels, buttons, logos, arrows, borders, rounded corners, page layout or watermark. The entire removed sky must be genuinely transparent, not white, black or a checkerboard painting. Do not introduce new people or objects.

## Autenticación · Mesa de viaje (16 de octubre de 2026)

`auth-travel-notebook.webp`: 1448 × 1086, WebP con alfa real. Recurso nuevo, creado
con la herramienta integrada ImageGen para la opción 2 aprobada. Referencia de
composición: `docs/design/assets/auth-mesa-2026-10-16/reference.png`; referencia de
estilo: `docs/design/assets/layout1-2026-10-13/reference.webp`. Se utiliza como
ilustración independiente a la izquierda de signup/signin y se oculta en móvil.
No contiene el mockup, formulario ni titulares. La tipografía manuscrita pertenece
a la ilustración, no a la interfaz. Créditos y procedencia quedan documentados aquí.

Prompt exacto (modo integrado, sin API/CLI):

> Use case: illustration-story. Asset type: isolated transparent illustration for the TravelPal signup page.
> Input images: Image 1 is the selected auth reference; use it for the still-life objects and arrangement only, excluding all webpage content. Image 2 is the landing reference; use it only for its Mediterranean gouache color treatment.
> Primary request: recreate only the travel still life illustration from Image 1 as a standalone illustration. Scene: no backdrop; genuinely transparent outside the objects. Subject: a cream open travel notebook at a diagonal angle, handwritten Spanish checklist and fine blue ink coastal village sketch on the left page, a colorful gouache Mediterranean coastal postcard on the right page; blue painted ceramic coffee cup upper left, olive sprig upper right, fountain pen lower left, boarding tickets peeking out behind the notebook, and a few loose olive leaves around it.
> Style: refined hand-painted gouache with delicate ink details, warm cream paper, rich restrained Mediterranean blue and olive colors consistent with Image 2. Composition: landscape approximately 4:3, objects fill most of frame with a little breathing room; notebook dominates center at natural diagonal like Image 1. Gentle painted contact shadows, warm soft daylight, calm travel journal mood; textured paper and softly worn notebook edges.
> Checklist text exactly: “Costa mediterránea”, “Pueblos con encanto”, “Playas escondidas”, “Buena comida”, “Dejarme llevar”.
> Constraints: only the illustration, natural object silhouettes, fully transparent background. Avoid any webpage, UI, title, headline, logo, form, border, background color or canvas fill, mockup, watermark, extra objects, or text outside the notebook.

`google.svg`: marca oficial de Google, descargada sin alteraciones desde
https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg. Copyright Google
Inc., según el propio recurso. Se conserva vectorial y con sus colores originales;
no fue dibujada ni generada.
