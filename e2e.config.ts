import type { E2EConfig } from 'e2e'
import { web } from '@e2e-dev/web'

const url = process.env.E2E_BASE_URL || 'http://localhost:3000'
const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)
const app = {
  url,
  ...(local ? {
    command: {
      executable: 'pnpm',
      args: ['exec', 'wrangler', 'dev', '--port', new URL(url).port || '3000', '--ip', '127.0.0.1'],
      reuseExisting: true,
      startupTimeout: 120_000,
      // El runner no hereda el entorno del proceso padre. El export ya contiene el bundle público.
      env: Object.fromEntries(Object.entries({
        NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
        NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
        NEXT_PUBLIC_LOG_LEVEL: 'warn',
      }).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    },
  } : {}),
}

// Suite complementaria: locators y assertions exactos, sin llamadas a modelos.
export default {
  projectId: 'travelpal',
  tests: 'tests/**/*.e2e.ts',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  assertionTimeout: 15_000,
  reporters: ['list', 'markdown', 'junit'],
  targets: [
    { name: 'desktop', engine: web({ viewport: { width: 1440, height: 900 } }), app },
    { name: 'narrow', engine: web({ viewport: { width: 390, height: 844 } }), app },
  ],
} satisfies E2EConfig
