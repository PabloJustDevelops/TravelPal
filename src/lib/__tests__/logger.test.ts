import { showToast } from '../toast'
import { logger } from '../logger'

jest.mock('../toast', () => ({ showToast: jest.fn() }))

describe('logger.error', () => {
  const originalLevel = process.env.NEXT_PUBLIC_LOG_LEVEL

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env.NEXT_PUBLIC_LOG_LEVEL = originalLevel
  })

  it('escribe en consola el detalle tecnico', () => {
    logger.error('AuthService: no se pudo comprobar la sesion', { error: 'Failed to fetch' })

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith('AuthService: no se pudo comprobar la sesion', {
      error: 'Failed to fetch',
    })
  })

  // El detalle interno no debe llegar a la interfaz: antes logger.error pintaba un toast
  // con el JSON del error y el usuario veia mensajes de implementacion.
  it('no pinta ningun toast al usuario', () => {
    logger.error('NotesPage: Error loading notes', { error: 'Network request failed' })

    expect(showToast).not.toHaveBeenCalled()
  })
})
