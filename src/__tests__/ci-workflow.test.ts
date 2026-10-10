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
    expect(ci.jobs['e2e-produccion'].with['base-url']).toBe('https://app-viajes.prg-dev.workers.dev')
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
