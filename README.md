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
hosting es **Cloudflare Workers** con `@opennextjs/cloudflare`.

## 🚀 Características

- ✅ Gestión completa de viajes: crear, editar y organizar itinerarios
- 💸 Control de gastos por viaje con categorías y métricas
- 💼 Presupuestos y seguimiento financiero
- 📊 Dashboard analítico con visualizaciones interactivas
- 🔐 Autenticación con InsForge (server actions; refresh token httpOnly)
- 🧩 Logger centralizado y notificaciones toast
- 📱 Diseño responsive y accesible

---

## 🗂️ Estructura del Proyecto

```
app-viajes/
├── src/
│   ├── app/                 # Rutas, páginas y API routes (App Router)
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
- Node.js 22+
- npm
- Un proyecto de InsForge (URL + anon key + API key)

### Instalación
```bash
git clone https://github.com/PabloJustDevelops/Proyecto-TravelPal-App-de-Viajes.git
cd Proyecto-TravelPal-App-de-Viajes
npm install
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

### Ejecución
```bash
npm run dev          # Desarrollo (http://localhost:3000)
npm run lint         # ESLint
npm run type-check   # TypeScript
npm run test:ci      # Jest
npm run test:e2e     # Playwright (ver docs/TESTING.md)
npm run build        # next build
```

### Despliegue (Cloudflare Workers)
```bash
npm run preview      # Build de OpenNext + wrangler dev local
npm run deploy       # Build de OpenNext + deploy a Cloudflare
```
`INSFORGE_API_KEY` es un secreto de runtime: se sube con `wrangler secret put INSFORGE_API_KEY`.

📖 **Documentación**

- **[CONTEXT.md](CONTEXT.md)**: contexto de dominio (stack, comandos, modelo de datos, glosario)
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: arquitectura y flujo de datos
- **[docs/DECISIONS/](docs/DECISIONS/)**: ADRs (InsForge, Cloudflare, esquema)
- **[docs/TECHNICAL.md](docs/TECHNICAL.md)**: guía técnica
- **[docs/TESTING.md](docs/TESTING.md)**: tests unitarios y E2E (Playwright)
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)**: cómo contribuir
- **[docs/COMMITS.md](docs/COMMITS.md)** / **[docs/PR_PROCESS.md](docs/PR_PROCESS.md)**: flujo de trabajo

---

## 🔧 Tecnologías

- Frontend: Next.js 16 (App Router), React 19, TypeScript
- Estilos: Tailwind CSS
- Backend: InsForge (Postgres, Auth, Storage) vía `@insforge/sdk`
- Hosting: Cloudflare Workers con `@opennextjs/cloudflare`
- Testing: Jest + Testing Library (unitarios y componentes) y Playwright (E2E)
- CI/CD: GitHub Actions (lint, type-check, tests, build y build del Worker)

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
