/** @jest-environment-options {"customExportConditions": ["node", "node-addons"]} */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

const ci = parse(readFileSync(resolve('.github/workflows/ci.yml'), 'utf8'))
const e2e = parse(readFileSync(resolve('.github/workflows/e2e.yml'), 'utf8'))

describe('puertas de despliegue', () => {
  it('exige E2E del codigo antes de desplegar main y vuelve a probar produccion', () => {
    expect(ci.jobs.deploy.needs).toEqual(expect.arrayContaining(['build', 'worker', 'e2e']))
    // Sin un if limitado a PR, el mismo test del codigo tambien se ejecuta en push a main.
    expect(ci.jobs.e2e.if).toBeUndefined()
    expect(ci.jobs['e2e-produccion'].needs).toEqual(['deploy'])
    expect(ci.jobs['e2e-produccion'].with['base-url']).toBe('https://travelpal.prg-dev.workers.dev')
  })

  it('construye, valida y publica el mismo export sin una clave privada', () => {
    const buildEnv = ci.jobs.build.env
    expect(buildEnv).toEqual(expect.objectContaining({
      NEXT_PUBLIC_INSFORGE_URL: expect.any(String),
      NEXT_PUBLIC_INSFORGE_ANON_KEY: expect.any(String),
    }))
    expect(buildEnv).not.toHaveProperty('INSFORGE_API_KEY')
    expect(ci.jobs.build.steps).toContainEqual(expect.objectContaining({ run: 'pnpm run validate:static-export' }))
    expect(ci.jobs.build.steps).toContainEqual(expect.objectContaining({
      uses: 'actions/upload-artifact@v4',
      with: expect.objectContaining({ name: 'travelpal-static-export', path: 'out/' }),
    }))
    expect(ci.jobs.worker.steps).toContainEqual(expect.objectContaining({
      uses: 'actions/download-artifact@v4',
      with: expect.objectContaining({ name: 'travelpal-static-export', path: 'out/' }),
    }))
    expect(ci.jobs.worker.steps).toContainEqual(expect.objectContaining({ run: 'pnpm exec wrangler deploy --dry-run --no-autoconfig' }))
    expect(ci.jobs.deploy.steps).toContainEqual(expect.objectContaining({ run: 'pnpm exec wrangler deploy --no-autoconfig' }))
    const deployEnv = ci.jobs.deploy.steps.find((step: { run?: string }) => step.run === 'pnpm exec wrangler deploy --no-autoconfig')?.env
    expect(deployEnv).toEqual(expect.objectContaining({
      CLOUDFLARE_API_TOKEN: expect.any(String),
      CLOUDFLARE_ACCOUNT_ID: 'c0fd3bd608ffa8d338164c60b7148c85',
    }))
    expect(deployEnv).not.toHaveProperty('INSFORGE_API_KEY')
  })

  it('ejecuta E2E predeploy sobre el export y deja producción sobre la URL publicada', () => {
    expect(e2e.jobs.e2e.steps).toContainEqual(expect.objectContaining({
      uses: 'actions/download-artifact@v4',
      if: "inputs.base-url == ''",
      with: expect.objectContaining({ name: 'travelpal-static-export', path: 'out/' }),
    }))
    expect(e2e.jobs.e2e.env.E2E_USER_EMAIL).toBeDefined()
    expect(e2e.jobs.e2e.env.E2E_USER_PASSWORD).toBeDefined()
    expect(e2e.jobs.e2e.env).not.toHaveProperty('INSFORGE_API_KEY')
  })

  it('no cancela un deploy iniciado y evita solapar pruebas del usuario compartido', () => {
    expect(ci.concurrency.group).toContain('github.ref')
    expect(ci.concurrency['cancel-in-progress']).toBe("${{ github.event_name == 'pull_request' }}")
    expect(e2e.jobs.e2e.concurrency).toEqual({
      group: 'travelpal-e2e-shared-user',
      'cancel-in-progress': false,
      queue: 'max',
    })
  })
})

it('instala el mismo pnpm fijado en el proyecto y exige su lockfile en cada job', () => {
  const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  expect(manifest.packageManager).toBe('pnpm@12.3.4')
  for (const job of [ci.jobs.build, ci.jobs.worker, ci.jobs.deploy, e2e.jobs.e2e]) {
    const setupIndex = job.steps.findIndex((step: { uses?: string }) => step.uses === 'pnpm/action-setup@v6')
    const nodeIndex = job.steps.findIndex((step: { uses?: string }) => step.uses === 'actions/setup-node@v4')
    expect(setupIndex).toBeGreaterThanOrEqual(0)
    expect(setupIndex).toBeLessThan(nodeIndex)
    expect(job.steps[nodeIndex].with.cache).toBe('pnpm')
    expect(job.steps).toContainEqual({ run: 'pnpm install --frozen-lockfile' })
    expect(job.steps.some((step: { run?: string }) => /\b(npm|npx)\b/.test(step.run || ''))).toBe(false)
  }
})

it('limita la cache immutable a los assets estaticos de Next', () => {
  const headers = readFileSync(resolve('public/_headers'), 'utf8')
  const generalHeaders = headers.split('/_next/static/*')[0]
  const cacheControlRules = headers.match(/^\s*Cache-Control:/gm) ?? []

  expect(generalHeaders).not.toMatch(/Cache-Control:/)
  expect(headers).toMatch(/\/_next\/static\/\*[\s\S]*Cache-Control: public,max-age=31536000,immutable/)
  expect(cacheControlRules).toHaveLength(1)
})

it('mantiene el token de mapas fuera del entorno público y elimina mapas antes de empaquetar', () => {
  expect(ci.jobs.build.env).not.toHaveProperty('SENTRY_AUTH_TOKEN')
  expect(ci.jobs.build.env.NEXT_PUBLIC_SENTRY_DSN).toBe('${{ vars.NEXT_PUBLIC_SENTRY_DSN }}')
  const steps = ci.jobs.build.steps
  const build = steps.findIndex((step: { run?: string }) => step.run === 'pnpm run build')
  const maps = steps.findIndex((step: { run?: string }) => step.run === 'node scripts/sentry-sourcemaps.mjs')
  const validate = steps.findIndex((step: { run?: string }) => step.run === 'pnpm run validate:static-export')
  expect(maps).toBeGreaterThan(build)
  expect(validate).toBeGreaterThan(maps)
  expect(steps[build].env.SENTRY_AUTH_TOKEN).toBe('${{ secrets.SENTRY_AUTH_TOKEN }}')
  expect(steps[maps].env.SENTRY_AUTH_TOKEN).toBe('${{ secrets.SENTRY_AUTH_TOKEN }}')
})
