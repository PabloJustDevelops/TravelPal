import { act, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { authService } from '@/lib/auth'

// El setup global sustituye AuthContext por un mock fijo; aqui se ejercita el
// provider real, asi que se pide el modulo autentico.
jest.mock('@/contexts/AuthContext', () => jest.requireActual('@/contexts/AuthContext'))

// El servicio real importa `@insforge/sdk/ssr` (ESM, no cargable bajo Jest) y
// las server actions usan `next/headers`: se mockea el modulo entero.
jest.mock('@/lib/auth', () => ({
  authService: {
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const mockedSignUp = authService.signUp as jest.Mock
const mockedGetCurrentUser = authService.getCurrentUser as jest.Mock

let api: ReturnType<typeof useAuth> | undefined

function Capture({
  onReady,
}: {
  onReady: (value: ReturnType<typeof useAuth>) => void
}) {
  const value = useAuth()
  useEffect(() => {
    onReady(value)
  }, [value, onReady])
  return null
}

const readApi = () => {
  if (!api) throw new Error('AuthProvider no ha publicado su api')
  return api
}

describe('AuthContext: alta y verificacion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetCurrentUser.mockResolvedValue(null)
  });

  const mount = () =>
    render(
      <AuthProvider>
        <Capture onReady={(value) => { api = value }} />
      </AuthProvider>,
    )

  it('signUp devuelve el flag y no relee una sesion que no existe', async () => {
    mockedSignUp.mockResolvedValue({ requireEmailVerification: true })
    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    let result: { requireEmailVerification: boolean } | undefined
    await act(async () => {
      result = await readApi().signUp('ana@example.com', 'Password1', 'Ana')
    })

    expect(result).toEqual({ requireEmailVerification: true })
    expect(mockedSignUp).toHaveBeenCalledWith(
      'ana@example.com',
      'Password1',
      'Ana',
    )
    // Verificacion pendiente: el alta no abre sesion, no hay nada que releer.
    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1)
  })

  it('refresca la sesion cuando el alta no pide verificacion', async () => {
    mockedSignUp.mockResolvedValue({ requireEmailVerification: false })
    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    await act(async () => {
      await readApi().signUp('ana@example.com', 'Password1', 'Ana')
    })

    expect(mockedGetCurrentUser).toHaveBeenCalledTimes(2)
  })

  it('verifyEmail relee el usuario para que la UI lo vea', async () => {
    const user = { id: 'user-123', email: 'ana@example.com' }
    ;(authService.verifyEmail as jest.Mock).mockResolvedValue({
      user: { id: user.id, email: user.email },
    })
    mockedGetCurrentUser.mockResolvedValue(user)

    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    let verified: unknown
    await act(async () => {
      verified = await readApi().verifyEmail('ana@example.com', '123456')
    })

    expect(authService.verifyEmail).toHaveBeenCalledWith(
      'ana@example.com',
      '123456',
    )
    expect(verified).toEqual(user)
  })

  it('resendVerificationEmail delega en el servicio', async () => {
    mount()
    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalledTimes(1))

    await act(async () => {
      await readApi().resendVerificationEmail('ana@example.com')
    })

    expect(authService.resendVerificationEmail).toHaveBeenCalledWith(
      'ana@example.com',
    )
  })
})
