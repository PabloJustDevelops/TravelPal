# Changelog

Todos los cambios relevantes de TravelPal. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [1.0.0] — 2026-10-29

Primera versión estable. La aplicación web queda terminada y publicada; lo que no entra en la 1.0
está listado en el README, sección «Después de la 1.0».

### Añadido

- **Viajes**: alta guiada, fechas, destino, viajeros, presupuesto inicial y portada.
- **Itinerario**: actividades por día con categorías, coste y reordenado accesible.
- **Tareas**: lista por estado y tablero, con persistencia real.
- **Notas**: dos paneles, favoritos y protección de borradores sin guardar.
- **Reservas**: vuelos, alojamiento y transporte junto a las fechas del viaje.
- **Gastos y presupuesto**: varias monedas sin mezclar totales, categorías, filtros y recibos.
- **Diario con fotos** almacenadas como privadas.
- **Inspiración de viaje**: vuelos desde la caché de Aviasales (Travelpayouts) y transporte
  terrestre con horarios reales de Transitous, ambos a través de funciones de InsForge.
- **Autenticación**: contraseña, verificación por correo y acceso con Google, con recuperación de
  contraseña.
- **Push de navegador**: flujo de cliente y función `send-push` desplegada.
- **Interfaz**: español e inglés, temas claro y oscuro, accesibilidad (contraste, foco visible,
  controles de 44 px, `prefers-reduced-motion`, axe en los flujos principales) y diseño adaptable
  de móvil a escritorio.

### Seguridad

- Aislamiento por usuario con RLS en Postgres: el navegador es el único camino de datos y cada
  política decide qué ve cada cuenta (ADR-009, ADR-012).
- Los secretos de proveedores externos viven en las funciones de InsForge, nunca en el cliente
  (ADR-015).
- Producción sirve solo assets estáticos desde un Worker de Cloudflare, sin servidor de Next.js ni
  route handlers; `pnpm run validate:static-export` lo comprueba antes de publicar (ADR-014).
- Content Security Policy con los hosts de las funciones declarados explícitamente.

### Cambiado

- Se retira el BFF: no quedan route handlers en `src/app` ni usuarios públicos en la base de datos.
- La exportación estática pasa a un Worker de solo assets.

### Pruebas

- 86 suites y 624 pruebas de Jest en verde; Vitest para las pruebas de interacción de Storybook y
  69 pruebas end-to-end de Playwright contra el artefacto exportado.
- CI en cada PR: `build`, `worker-build` y `e2e`; `deploy` y `e2e-produccion` solo en `main`.

### Fallos conocidos

- **#156**: si alguien crea la cuenta y cierra el paso del código de verificación, no hay forma de
  volver a escribirlo desde la interfaz. Se corrige en 1.0.1.
- La entrega de push está desplegada pero **no verificada en un dispositivo real** (ADR-013).
- Los usuarios creados por las pruebas e2e de alta siguen sin un mecanismo administrativo de
  limpieza.

[1.0.0]: https://github.com/PabloJustDevelops/TravelPal/releases/tag/v1.0.0
