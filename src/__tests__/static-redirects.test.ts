import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('redirecciones de rutas de recursos', () => {
  const redirects = readFileSync(join(process.cwd(), 'public/_redirects'), 'utf8')

  it('conserva el id de los enlaces antiguos de detalle de viaje', () => {
    expect(redirects).toContain('/trips/:id /trip?id=:id 301')
  })

  it('redirige la ruta de alta a su URL superior antes de la regla de detalle', () => {
    const createPageRule = '/trips/new /create-trip 301'
    const createPageIndex = redirects.indexOf(createPageRule)
    const detailRuleIndex = redirects.indexOf('/trips/:id /trip?id=:id 301')

    expect(createPageIndex).toBeGreaterThanOrEqual(0)
    expect(detailRuleIndex).toBeGreaterThan(createPageIndex)
  })

  it('exporta el formulario en la ruta superior de alta', () => {
    expect(existsSync(join(process.cwd(), 'src/app/create-trip/page.tsx'))).toBe(true)
  })

  it('conserva el id de los enlaces antiguos de edición de gastos', () => {
    expect(redirects).toContain('/expenses/:id/edit /expense-edit?id=:id 301')
  })
})
