import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('redirecciones de rutas de recursos', () => {
  const redirects = readFileSync(join(process.cwd(), 'public/_redirects'), 'utf8')

  it('conserva el id de los enlaces antiguos de detalle de viaje', () => {
    expect(redirects).toContain('/trips/:id /trip?id=:id 301')
  })

  it('conserva el id de los enlaces antiguos de edición de gastos', () => {
    expect(redirects).toContain('/expenses/:id/edit /expense-edit?id=:id 301')
  })
})
