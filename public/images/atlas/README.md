# Original TravelPal illustrations

Created on 13 October 2026 with the integrated ImageGen tool. These are fictional
illustrated scenes, not photographs or depictions of real destinations or users. No
stock photos or third-party references were used. The visible credit is
"Ilustración original creada para TravelPal con IA".

- `coastal-journey.webp`: 1536 × 1024, WebP quality 82. Cover and sign-in panel. Alt: a
  traveler on a path toward a Mediterranean coastal village, with mountains and a
  sailboat.
- `travel-notebook.webp`: 1024 × 1024, WebP quality 82. Asset kept from the visual
  exploration; not used in the selected landing page. Alt: a travel notebook with a
  drawn route, a compass and a map on a table.

The original PNGs were kept outside the repository; the web assets were encoded with
Sharp, with no generator metadata. Components declare dimensions and `sizes`; only the
cover preloads its image.

## Prompts used (integrated tool, no API/CLI)

### Coastal journey

Use case: illustration-story. Asset type: original TravelPal website hero illustration, reused as auth artwork. Create a sophisticated editorial travel illustration in a wide 3:2 landscape format. A winding terracotta footpath leads from foreground Mediterranean dunes through a small warm ivory coastal village toward a deep muted teal sea, distant mountains and a pale apricot sun. A tiny traveler with a backpack walks the path, an understated sailboat on the sea, olive foliage in foreground. Travel atlas aesthetic, tactile cut paper and gouache textures, refined geometric scenery, restrained palette of warm ivory #f7f4ed, terracotta #c75b39, muted sea teal #397c79, ochre and ink navy. Strong layered composition, inviting atmosphere, crisp intentional shapes, high quality illustrated travel journal cover. Image only, no text, letters, logos, watermark, UI, borders, photo elements or stock photography. Landscape scene fills the canvas, light sky in upper third. This must be custom artwork, not a photograph.

### Travel notebook

Use case: illustration-story. Asset type: original TravelPal website illustration, square 1:1 composition. An overhead still life of a travel journal open on a pale cool neutral desk, simple hand-drawn coastline route with a dotted blue path on its unlined pages, a compass, a blue pen, a train ticket with abstract marks only, an olive branch and the corner of a folded soft blue map. Sophisticated gouache and cut-paper editorial illustration, tactile paper texture, light clean background, restrained ink navy, cobalt blue and sage green with tiny terracotta details. Bright natural light. Carefully composed travel planning objects, elegant and calming, full canvas. No readable text, letters, numbers, logos, watermark, UI, photographic elements or stock photography. Custom illustration for a travel planning app following the Atlas light direction.

## Overview of the selected layout

`coastal-panorama.webp`: 1774 × 887, 323360 bytes, WebP quality 85 and alphaQuality 100.
Derived with ImageGen from the original coastal illustration and the selected mock; it
keeps real transparency in the sky so it blends with the light and dark tokens.

Prompt: Edit the original TravelPal coastal illustration into a production hero raster asset matching the scenic layout in the selected website. Output ONLY the scenic artwork, NOT the webpage or any text/UI. Very wide panoramic landscape, approximately 2:1 aspect ratio. Preserve the original painterly gouache style, exact recognizable village, teal sea, mountains, sailboat, tiny backpack traveler and terracotta path. Recompose it like the selected website: village and traveler at lower left, sea at right, distant mountains rising toward the upper right. Remove all upper-left olive-tree branches that intrude into the heading area; retain lower-left foreground foliage. Remove the sky entirely to real alpha transparency, including upper-left area; preserve isolated apricot sun at upper right and any fine skyline edges. In the top-left 55 percent of canvas, leave a generous transparent region for a two-line website title. Scenic land/sea fills lower 45 percent edge to edge; right-hand mountains rise higher to around 45 percent of height. No text, letters, labels, buttons, logos, arrows, borders, rounded corners, page layout or watermark. The entire removed sky must be genuinely transparent, not white, black or a checkerboard painting. Do not introduce new people or objects.

## Authentication · travel desk (16 October 2026)

`auth-travel-notebook.webp`: 1448 × 1086, WebP with real alpha. New asset, created with
the integrated ImageGen tool for the approved option 2. Composition reference:
`docs/design/assets/auth-mesa-2026-10-16/reference.png`; style reference:
`docs/design/assets/layout1-2026-10-13/reference.webp`. It is used as a standalone
illustration to the left of signup/signin and is hidden on mobile. It contains no
mockup, form or headings. The handwritten typography belongs to the illustration, not
to the interface. Credits and provenance are documented here.

Exact prompt (integrated mode, no API/CLI):

> Use case: illustration-story. Asset type: isolated transparent illustration for the TravelPal signup page.
> Input images: Image 1 is the selected auth reference; use it for the still-life objects and arrangement only, excluding all webpage content. Image 2 is the landing reference; use it only for its Mediterranean gouache color treatment.
> Primary request: recreate only the travel still life illustration from Image 1 as a standalone illustration. Scene: no backdrop; genuinely transparent outside the objects. Subject: a cream open travel notebook at a diagonal angle, handwritten Spanish checklist and fine blue ink coastal village sketch on the left page, a colorful gouache Mediterranean coastal postcard on the right page; blue painted ceramic coffee cup upper left, olive sprig upper right, fountain pen lower left, boarding tickets peeking out behind the notebook, and a few loose olive leaves around it.
> Style: refined hand-painted gouache with delicate ink details, warm cream paper, rich restrained Mediterranean blue and olive colors consistent with Image 2. Composition: landscape approximately 4:3, objects fill most of frame with a little breathing room; notebook dominates center at natural diagonal like Image 1. Gentle painted contact shadows, warm soft daylight, calm travel journal mood; textured paper and softly worn notebook edges.
> Checklist text exactly: “Costa mediterránea”, “Pueblos con encanto”, “Playas escondidas”, “Buena comida”, “Dejarme llevar”.
> Constraints: only the illustration, natural object silhouettes, fully transparent background. Avoid any webpage, UI, title, headline, logo, form, border, background color or canvas fill, mockup, watermark, extra objects, or text outside the notebook.

`google.svg`: official Google mark, downloaded unaltered from
https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg. Copyright Google
Inc., per the asset itself. It is kept as a vector with its original colors; it was
neither drawn nor generated.
