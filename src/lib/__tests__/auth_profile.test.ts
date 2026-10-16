import { AuthService } from '../auth'
import { createInsforgeClient } from '../insforge'

jest.mock('../insforge', () => ({ createInsforgeClient: jest.fn() }))
jest.mock('../logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } }))
jest.mock('../utils', () => ({ getErrorMessage: (error: Error) => error.message }))

describe('AuthService profile update', () => {
  const auth = { getCurrentUser: jest.fn(), setProfile: jest.fn() }
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    upsert: jest.fn(),
  }
  const client = { auth, database: { from: jest.fn(() => query) }, storage: { from: jest.fn() } }
  let service: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createInsforgeClient as jest.Mock).mockReturnValue(client)
    auth.getCurrentUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com', profile: null } }, error: null })
    query.maybeSingle.mockResolvedValue({ data: { full_name: 'Old Name' }, error: null })
    query.upsert.mockResolvedValue({ error: null })
    auth.setProfile.mockResolvedValue({ data: {}, error: null })
    service = new AuthService()
  })

  it('actualiza perfil de auth y fila profiles con la misma identidad', async () => {
    await service.updateProfile({ full_name: 'New Name' })
    expect(auth.setProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name', full_name: 'New Name' }))
    expect(client.database.from).toHaveBeenCalledWith('profiles')
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', full_name: 'New Name' }))
  })

  it('rechaza una actualización que supera el límite de espera', async () => {
    query.upsert.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 21000)))
    await expect(service.updateProfile({ full_name: 'Timeout Name' })).rejects.toThrow('Update profile timed out after 20s')
  }, 25000)

  it('no actualiza el perfil cuando no hay una sesión válida', async () => {
    auth.getCurrentUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(service.updateProfile({})).rejects.toThrow('No user logged in')
    expect(auth.setProfile).not.toHaveBeenCalled()
  })
})
