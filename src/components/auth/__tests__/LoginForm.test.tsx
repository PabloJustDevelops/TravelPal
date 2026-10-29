import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginForm from '../LoginForm'
import { useAuth } from '@/contexts/AuthContext'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockSignIn = jest.fn()
const mockVerifyEmail = jest.fn()
const mockResendVerificationEmail = jest.fn()
const mockSignInWithGoogle = jest.fn()
const mockPathname = '/es/signin'

let mockSearch = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
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
      verifyEmail: mockVerifyEmail,
      resendVerificationEmail: mockResendVerificationEmail,
      signInWithGoogle: mockSignInWithGoogle,
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

  it('vuelve a la ruta protegida con sus filtros tras iniciar sesión', async () => {
    mockSearch = new URLSearchParams(
      'redirectTo=%2Fexpenses%3Fcategory%3Dtravel%26search%3Drome',
    )
    mockSignIn.mockResolvedValue({
      ok: true,
      user: { id: 'user-123', email: 'ana@example.com' },
    })

    render(<LoginForm />)
    fillAndSubmit()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/expenses?category=travel&search=rome')
    })
  })

  it('nombra el control de visibilidad y actualiza el nombre al mostrar la contraseña', async () => {
    render(<LoginForm />)

    const showPasswordButton = await screen.findByRole('button', {
      name: 'Mostrar contraseña',
    })
    fireEvent.click(showPasswordButton)

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text')
    expect(
      screen.getByRole('button', { name: 'Ocultar contraseña' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('pide el codigo en el login cuando el email no esta verificado (#156)', async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      code: 'email_not_verified',
      statusCode: 403,
    })
    mockVerifyEmail.mockResolvedValue({ id: 'user-123' })

    render(<LoginForm />)
    fillAndSubmit()

    // El paso del codigo sustituye al formulario: antes solo habia un aviso y
    // un boton de reenvio, sin campo donde escribir el codigo.
    expect(
      await screen.findByRole('heading', { name: 'Verifica tu email' }),
    ).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid credentials|verification required/i)).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()

    const inputs = screen.getAllByLabelText(/Dígito \d del código/i)
    '123456'.split('').forEach((digit, index) => {
      fireEvent.change(inputs[index], { target: { value: digit } })
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Verificar cuenta' }).closest('form') as HTMLFormElement,
    )

    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith('ana@example.com', '123456')
    })
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('respeta el redirectTo al verificar desde el login', async () => {
    mockSearch = new URLSearchParams('redirectTo=%2Fsettings')
    mockSignIn.mockResolvedValue({
      ok: false,
      code: 'email_not_verified',
      statusCode: 403,
    })
    mockVerifyEmail.mockResolvedValue({ id: 'user-123' })

    render(<LoginForm />)
    fillAndSubmit()

    const inputs = await screen.findAllByLabelText(/Dígito \d del código/i)
    '123456'.split('').forEach((digit, index) => {
      fireEvent.change(inputs[index], { target: { value: digit } })
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Verificar cuenta' }).closest('form') as HTMLFormElement,
    )

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/settings')
    })
  })

  it('vuelve al formulario de acceso desde el paso del codigo', async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      code: 'email_not_verified',
      statusCode: 403,
    })

    render(<LoginForm />)
    fillAndSubmit()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Volver a iniciar sesión' }),
    )

    expect(
      screen.getByRole('heading', { name: 'Inicia sesión en tu cuenta' }),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument()
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
      expect(mockReplace).toHaveBeenCalledWith('/es/signin')
    })
  })

  it('conserva el redirectTo al limpiar el mensaje del reset', async () => {
    mockSearch = new URLSearchParams(
      'message=password-updated&redirectTo=%2Fsettings',
    )

    render(<LoginForm />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/es/signin?redirectTo=%2Fsettings')
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
      expect(mockReplace).toHaveBeenCalledWith('/es/signin')
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
    mockSignInWithGoogle.mockResolvedValue(undefined)

    render(<LoginForm />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    )

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
    })
  })
})
