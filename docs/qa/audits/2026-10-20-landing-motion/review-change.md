# Revisión independiente del cambio · primer pase

[P2] Permite que el contenedor de imagen se contraiga en el grid — `src/components/landing/LandingImage.tsx:18`

El nuevo `aspectRatio` impone un tamaño mínimo que estrecha la columna de texto de Features. A 1024 px, el texto mide 984,5 px de alto dentro de una sección de 622,5 px y `overflow-hidden` recorta contenido. También ocurre a 1100, 1200 y 1280 px. Aplicar `min-width: 0` al contenedor recupera las columnas y evita el recorte, comprobado en Chromium.

Sin otros hallazgos tras recorrer todo el diff. `pnpm exec jest --runInBand --coverage=false src/components/landing/__tests__/landing.test.tsx`: exit 0, 8 pruebas aprobadas. Falta cobertura de los anchos intermedios; Storybook sigue pendiente y no se considera aprobado.

---

Este informe corresponde al primer pase; ver la revisión posterior a la corrección en `review-final.md`.
