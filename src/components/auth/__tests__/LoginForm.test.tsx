import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginForm from '../LoginForm'
import { useAuth } from '@/contexts/AuthContext'
import { initiateOAuthAction } from '@/lib/insforge/auth-actions'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockSignIn = jest.fn()
const mockResendVerificationEmail = jest.fn()

let mockSearch = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearch,
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

// El botón de Google llama a esta server action: mockeada para no cargar el
// módulo del SDK (ESM) bajo jest.
jest.mock('@/lib/insforge/auth-actions', () => ({
  initiateOAuthAction: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const fillAndSubmit = () => {
  fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
    target: { value: 'ana@example.com' },
  })
  fireEvent.change(screen.getByPlaceholderText('Tu contraseña'), {
    target: { value: 'Password1' },
  })
  const form = screen
    .getByRole('button', { name: 'Iniciar sesión' })
    .closest('form')
  fireEvent.submit(form as HTMLFormElement)
}

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearch = new URLSearchParams()
    ;(useAuth as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      resendVerificationEmail: mockResendVerificationEmail,
    })
  })

  it('entra al dashboard cuando el login devuelve usuario', async () => {
    mockSignIn.mockResolvedValue({
      ok: true,
      user: { id: 'user-123', email: 'ana@example.com' },
    })

    render(<LoginForm />)
    fillAndSubmit()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('avisa de que hay que verificar el email y ofrece reenviar el codigo', async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      code: 'email_not_verified',
      statusCode: 403,
    })

    render(<LoginForm />)
    fillAndSubmit()

    expect(
      await screen.findByText(/no está verificado/i),
    ).toBeInTheDocument()
    // Nada de mensaje crudo del backend ni de redireccion.
    expect(screen.queryByText(/Invalid credentials|verification required/i)).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()

    mockResendVerificationEmail.mockResolvedValue(undefined)
    fireEvent.click(
      screen.getByRole('button', { name: /reenviar código de verificación/i }),
    )

    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('ana@example.com')
    })
    expect(
      await screen.findByText(/te hemos enviado un código nuevo/i),
    ).toBeInTheDocument()
  })

  it('muestra el error del reenvio sin sacar al usuario del formulario', async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      code: 'email_not_verified',
      statusCode: 403,
    })
    mockResendVerificationEmail.mockRejectedValue(
      new Error('Too many send email verification requests from this IP'),
    )

    render(<LoginForm />)
    fillAndSubmit()

    fireEvent.click(
      await screen.findByRole('button', { name: /reenviar código de verificación/i }),
    )

    expect(
      await screen.findByText(
        /too many send email verification requests from this ip/i,
      ),
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('da un mensaje generico con credenciales invalidas y no filtra el del backend', async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      code: 'invalid_credentials',
      statusCode: 401,
    })

    render(<LoginForm />)
    fillAndSubmit()

    expect(
      await screen.findByText(/email o contraseña incorrectos/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Invalid credentials/i)).not.toBeInTheDocument()
  })

  it('avisa cuando hay demasiados intentos', async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      code: 'rate_limited',
      statusCode: 429,
    })

    render(<LoginForm />)
    fillAndSubmit()

    expect(await screen.findByText(/demasiados intentos/i)).toBeInTheDocument()
  })

  it('muestra la confirmacion del reset y limpia el parametro de la URL', async () => {
    mockSearch = new URLSearchParams('message=password-updated')

    render(<LoginForm />)

    expect(
      await screen.findByText(/contraseña se ha actualizado/i),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/signin')
    })
  })

  it('conserva el redirectTo al limpiar el mensaje del reset', async () => {
    mockSearch = new URLSearchParams(
      'message=password-updated&redirectTo=%2Fsettings',
    )

    render(<LoginForm />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/signin?redirectTo=%2Fsettings')
    })
  })

  it('no rompe ni inventa nada con un message desconocido', async () => {
    mockSearch = new URLSearchParams('message=vete-a-saber')

    render(<LoginForm />)

    expect(
      screen.getByRole('heading', { name: 'Inicia sesión en tu cuenta' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/vete-a-saber/i)).not.toBeInTheDocument()
  })

  it('muestra el fallo del OAuth que escribe el callback', async () => {
    mockSearch = new URLSearchParams('message=oauth-failed')

    render(<LoginForm />)

    expect(
      await screen.findByText(/no se pudo iniciar sesión con google/i),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/signin')
    })
  })

  it('muestra el aviso de caducidad cuando el verifier ya no está', async () => {
    mockSearch = new URLSearchParams('message=oauth-expired')

    render(<LoginForm />)

    expect(
      await screen.findByText(/el acceso con google caducó/i),
    ).toBeInTheDocument()
  })

  it('ofrece continuar con Google y arranca el OAuth al pulsarlo', async () => {
    ;(initiateOAuthAction as jest.Mock).mockResolvedValue(undefined)

    render(<LoginForm />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    )

    await waitFor(() => {
      expect(initiateOAuthAction).toHaveBeenCalledWith('google')
    })
  })
})
