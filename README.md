<div align="center">
  <img src="src/app/icon.svg" alt="TravelPal" width="120" />
  <h1>TravelPal</h1>
  <p><strong>Planifica, reserva y controla tus viajes</strong><br/>Una plataforma completa para itinerarios, gastos, presupuestos y analíticas.</p>

  <p>
    <a href="#instalacion">Instalación</a> ·
    <a href="#caracteristicas">Características</a> ·
    <a href="#documentacion">Documentación</a> ·
    <a href="#roadmap">Roadmap</a>
  </p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img alt="InsForge" src="https://img.shields.io/badge/InsForge-Backend-4B5563" />
    <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" />
    <img alt="CI/CD" src="https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?logo=githubactions&logoColor=white" />
  </p>
</div>

## 📋 Descripción

TravelPal es una aplicación web para gestionar todo el ciclo de un viaje: itinerarios, control de
gastos, presupuestos y analíticas. El backend es **InsForge** (Postgres + Auth + Storage) y el
hosting sirve el export estático de Next.js desde un Worker de assets de **Cloudflare**. La
aplicación no ejecuta un servidor Next.js en producción.

## 🚀 Características

- ✅ Gestión completa de viajes: crear, editar y organizar itinerarios
- 💸 Control de gastos por viaje con categorías y métricas
- 💼 Presupuestos y seguimiento financiero
- 📊 Dashboard analítico con visualizaciones interactivas
- 🔐 Autenticación en el navegador con InsForge; RLS protege los datos del usuario
- 🧩 Logger centralizado y notificaciones toast
- 📱 Diseño responsive y accesible

---

## 🗂️ Estructura del Proyecto

```
app-viajes/
├── src/
│   ├── app/                 # Páginas exportables (App Router)
│   ├── components/          # UI y componentes por dominio
│   ├── lib/                 # Clientes (insforge), auth, utilidades
│   └── contexts/            # Contextos de React
├── migrations/              # Esquema InsForge (fuente de verdad, ver ADR-004)
├── docs/                    # Documentación colaborativa
├── .github/                 # Workflows, plantillas y labels
├── CONTEXT.md               # Contexto de dominio para agentes
└── README.md
```

---

## ⚙️ Instalación y Uso

### Prerrequisitos
- Node.js 22.22.3+ (o 24.8+)
- pnpm 12.3.4 (versión fijada en `package.json`)
- Un proyecto de InsForge (URL + clave anónima pública; API key opcional para utilidades locales)

### Instalación
```bash
git clone https://github.com/PabloJustDevelops/TravelPal.git
cd TravelPal
npm install --global pnpm@12.3.4 # solo si todavía no tienes pnpm
pnpm install --frozen-lockfile
```

### Configuración
```bash
# Copiar variables de entorno
cp .env.example .env.local
```

Variables de `.env.local` (nunca se versionan):
```bash
NEXT_PUBLIC_INSFORGE_URL=https://<appkey>.<region>.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<anon key>
INSFORGE_API_KEY=<api key de proyecto, solo servidor>
```
`INSFORGE_API_KEY` es opcional para utilidades administrativas locales; el export estático y el
Worker de producción no la reciben.

### Ejecución
```bash
pnpm run dev          # Desarrollo (http://localhost:3000)
pnpm run lint         # ESLint
pnpm run type-check   # TypeScript
pnpm run test:ci      # Jest
pnpm run test:e2e     # Playwright (ver docs/TESTING.md)
pnpm run test:tester  # Tester Army: acceso publico, escritorio y viewport estrecho
pnpm run storybook    # Catálogo de componentes: http://localhost:6006
pnpm run test:storybook # Interacciones y axe de las stories en Chromium
pnpm run build        # next build
```

### Despliegue (Cloudflare Workers)
```bash
pnpm run build                    # next build genera el export estático en out/
pnpm run validate:static-export   # valida rutas, redirecciones y ausencia de claves privadas
pnpm run preview                  # wrangler dev sirve el out/ existente en local
pnpm run deploy                   # vuelve a compilar, valida out/ y publica con Wrangler
```
`pnpm run preview` no compila: requiere ejecutar antes `pnpm run build` y el validador. El Worker
publicado solo contiene assets estáticos y no recibe secretos de runtime. `pnpm run deploy` requiere
autenticación de Wrangler; en CI se usa `CLOUDFLARE_API_TOKEN`.

📖 **Documentación**

- **[CONTEXT.md](CONTEXT.md)**: contexto de dominio (stack, comandos, modelo de datos, glosario)
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: arquitectura y flujo de datos
- **[docs/DECISIONS/](docs/DECISIONS/)**: ADRs (InsForge, Cloudflare, esquema)
- **[docs/TECHNICAL.md](docs/TECHNICAL.md)**: guía técnica
- **[docs/TESTING.md](docs/TESTING.md)**: tests unitarios y E2E (Playwright)
- **[docs/TESTER-ARMY.md](docs/TESTER-ARMY.md)**: suite complementaria y evaluación de Tester Army
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)**: cómo contribuir
- **[docs/COMMITS.md](docs/COMMITS.md)** / **[docs/PR_PROCESS.md](docs/PR_PROCESS.md)**: flujo de trabajo

---

## 🔧 Tecnologías

- Frontend: Next.js 16 (App Router), React 19, TypeScript
- Estilos: Tailwind CSS
- Backend: InsForge (Postgres, Auth, Storage) vía `@insforge/sdk`
- Hosting: export estático de Next.js en Cloudflare Workers Assets (Wrangler); `@opennextjs/cloudflare`
  permanece como dependencia de desarrollo, pero no se usa para publicar producción
- Testing: Jest + Testing Library, Playwright (flujos con datos) y Tester Army (acceso público)
- CI/CD: GitHub Actions; export, validación, dry-run de Wrangler y E2E antes del deploy; E2E contra
  producción después

## 📋 Roadmap
- Internacionalización (i18n)
- Integración con más APIs de viajes
- Sistema de colaboración en viajes
- App móvil (React Native)

## 👥 Contribuidores

- **[Pablo Rodríguez Garijo](https://github.com/PabloJustDevelops)** - Desarrollador principal
- **Alejandro García Redondo** - Desarrollador ayudante

## 🤝 Contribuir

1. Crea una rama para tu cambio
2. Commit con Conventional Commits (ver [docs/COMMITS.md](docs/COMMITS.md))
3. Abre un Pull Request (ver [docs/PR_PROCESS.md](docs/PR_PROCESS.md))

## 📄 Licencia

MIT.

## 📞 Contacto

Pablo Rodríguez Garijo - [@PabloJustDevelops](https://github.com/PabloJustDevelops)
