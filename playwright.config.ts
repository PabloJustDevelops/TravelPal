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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
