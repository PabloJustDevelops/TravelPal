import { render, screen, waitFor } from '@testing-library/react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockedUseAuth = useAuth as jest.Mock
const mockedUseRouter = useRouter as jest.Mock

const replace = jest.fn()
const reloadSession = jest.fn()

const authValue = (overrides: Record<string, unknown> = {}) => ({
  user: null,
  loading: false,
  sessionError: false,
  reloadSession,
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  resetPassword: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
  updateProfile: jest.fn(),
  uploadAvatar: jest.fn(),
  ...overrides,
})

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedUseRouter.mockReturnValue({ replace })
  })

  it('no redirige ni deja la pantalla en blanco si no se pudo comprobar la sesion', () => {
    // Caso del rebote: el middleware si ve la cookie de sesion, pero la
    // comprobacion del cliente falla. Redirigir a /signin provocaria el bucle.
    mockedUseAuth.mockReturnValue(authValue({ sessionError: true }))

    render(
      <ProtectedRoute>
        <div>contenido privado</div>
      </ProtectedRoute>,
    )

    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
    expect(screen.queryByText('contenido privado')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('redirige a /signin cuando el servidor confirma que no hay sesion', async () => {
    mockedUseAuth.mockReturnValue(authValue())

    render(
      <ProtectedRoute>
        <div>contenido privado</div>
      </ProtectedRoute>,
    )

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/signin'))
  })

  it('pinta el contenido cuando hay usuario', () => {
    mockedUseAuth.mockReturnValue(
      authValue({ user: { id: 'u1', email: 'ana@example.com' } }),
    )

    render(
      <ProtectedRoute>
        <div>contenido privado</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('contenido privado')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
