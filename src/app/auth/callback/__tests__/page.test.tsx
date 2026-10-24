import { render, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { authService } from '@/lib/auth'
import AuthCallbackPage from '../page'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authService: { getCurrentUser: jest.fn() } }))

const replace = jest.fn()
const mockedGetCurrentUser = authService.getCurrentUser as jest.Mock

describe('/auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.history.replaceState({}, '', '/auth/callback')
    ;(useRouter as jest.Mock).mockReturnValue({ replace })
  })

  it('navega al dashboard cuando el SDK intercambia el código y restaura la sesión', async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'ana@example.com' })
    render(<AuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('devuelve a signin si el proveedor deniega el acceso o falla el intercambio', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)
    render(<AuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/es/signin?message=oauth-failed'))
  })

  it('devuelve al acceso inglés si OAuth se inició desde ese locale', async () => {
    window.history.replaceState({}, '', '/auth/callback?locale=en')
    mockedGetCurrentUser.mockResolvedValue(null)
    render(<AuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en/signin?message=oauth-failed'))
  })

  it('devuelve a signin si el SDK no puede comprobar la sesión intercambiada', async () => {
    mockedGetCurrentUser.mockRejectedValue(new Error('network down'))
    render(<AuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/es/signin?message=oauth-failed'))
  })
})
