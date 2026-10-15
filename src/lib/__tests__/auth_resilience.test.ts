import { AuthService } from '../auth'
import { createInsforgeClient } from '../insforge'

jest.mock('../insforge', () => ({ createInsforgeClient: jest.fn() }))
jest.mock('../logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } }))

describe('AuthService session resilience', () => {
  const auth = { getCurrentUser: jest.fn() }
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  }
  const client = { auth, database: { from: jest.fn(() => query) }, storage: { from: jest.fn() } }
  let service: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createInsforgeClient as jest.Mock).mockReturnValue(client)
    service = new AuthService()
  })

  it('mantiene el usuario básico si falla la consulta de profiles', async () => {
    auth.getCurrentUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', profile: { name: 'Ana', avatar_url: '/ana.png' } } },
      error: null,
    })
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })
    await expect(service.getCurrentUser()).resolves.toEqual({
      id: 'u1', email: 'a@b.com', full_name: 'Ana', avatar_url: '/ana.png',
      bio: undefined, phone: undefined, location: undefined, website: undefined,
    })
  })

  it('devuelve null cuando no existe una sesión', async () => {
    auth.getCurrentUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(service.getCurrentUser()).resolves.toBeNull()
    expect(client.database.from).not.toHaveBeenCalled()
  })

  it('propaga un fallo de red para distinguirlo de una sesión ausente', async () => {
    auth.getCurrentUser.mockResolvedValue({ data: { user: null }, error: { message: 'network down', statusCode: 503 } })
    await expect(service.getCurrentUser()).rejects.toThrow('network down')
  })

  it('devuelve null si la sesión expira mientras profiles dispara signedOut', async () => {
    const cachedUser = { id: 'u1', email: 'a@b.com', profile: { name: 'Ana' } }
    let currentSessionUser: typeof cachedUser | null = cachedUser
    auth.getCurrentUser.mockImplementation(async () => ({
      data: { user: currentSessionUser },
      error: null,
    }))
    query.maybeSingle.mockImplementation(async () => {
      // El SDK borra la sesión en memoria al fallar el refresh mientras
      // profiles está en curso; la siguiente lectura debe reflejarlo.
      currentSessionUser = null
      return { data: null, error: { message: 'Unauthorized', statusCode: 401 } }
    })

    await expect(service.getCurrentUser()).resolves.toBeNull()
    expect(auth.getCurrentUser).toHaveBeenCalledTimes(2)
  })
})
