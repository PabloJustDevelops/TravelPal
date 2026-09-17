import { defineConfig, devices } from '@playwright/test'

// `.env.local` es el fichero de entorno de la casa (esta en .gitignore) y ya trae
// las claves de InsForge: cargarlo deja el runner con lo mismo que ve la app. No
// pisa lo que venga del entorno, asi que en CI (donde el fichero no existe) los
// secrets del job mandan.
try {
  process.loadEnvFile('.env.local')
} catch {
  // Sin .env.local: las variables tienen que venir del entorno.
}

// Dos modos de la misma suite (issue 72): en el PR se prueba el codigo del PR
// contra el dev server local y, tras el deploy de main, lo desplegado. El
// destino lo elige E2E_BASE_URL y por defecto es localhost.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(baseURL)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Dos proyectos y no uno: el smoke puede correr en paralelo, pero los flujos
  // de `e2e/flows` comparten estado (el mismo usuario dedicado y las mismas
  // pantallas: alta de viaje, itinerario, gastos) y no ganan nada con ir a la
  // vez. Con los cuatro workers locales sobre un solo `next dev`, que compila
  // las rutas on-demand, la navegacion a `/trips/<uuid>` tras "Crear Viaje" se
  // agotaba en el `toHaveURL` y caia un spec distinto en cada corrida. Un worker
  // para el directorio entero quita esa carrera; el smoke sigue en paralelo.
  projects: [
    {
      name: 'smoke',
      testMatch: 'smoke/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'flows',
      testMatch: 'flows/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
      workers: 1,
    },
  ],
  // Contra produccion no se arranca nada: se prueba lo desplegado.
  webServer: isLocalTarget
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
})
