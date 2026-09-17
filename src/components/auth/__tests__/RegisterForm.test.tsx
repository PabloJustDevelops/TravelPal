import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import RegisterForm from '../RegisterForm'
import { useAuth } from '@/contexts/AuthContext'

const mockReplace = jest.fn()
const mockSignUp = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockReplace }),
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

const fillForm = () => {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre completo'), {
    target: { value: 'Ana Perez' },
  })
  fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
    target: { value: 'ana@example.com' },
  })
  fireEvent.change(screen.getByPlaceholderText('Tu contraseña'), {
    target: { value: 'Password1' },
  })
  fireEvent.change(screen.getByPlaceholderText('Confirma tu contraseña'), {
    target: { value: 'Password1' },
  })
}

const submit = () => {
  const form = screen
    .getByRole('button', { name: /crear cuenta/i })
    .closest('form')
  fireEvent.submit(form as HTMLFormElement)
}

describe('RegisterForm: rama del alta', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({
      signUp: mockSignUp,
      verifyEmail: jest.fn(),
      resendVerificationEmail: jest.fn(),
    })
  })

  it('pasa al paso del codigo cuando el backend pide verificar el email', async () => {
    mockSignUp.mockResolvedValue({ ok: true, requireEmailVerification: true })

    render(<RegisterForm />)
    fillForm()
    submit()

    expect(await screen.findByText(/Verifica tu email/i)).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    // El alta verificada no navega por su cuenta: espera al codigo.
    expect(mockReplace).not.toHaveBeenCalled()
    // El "Revisa tu email" hardcodeado ya no existe.
    expect(screen.queryByText(/revisa tu email/i)).not.toBeInTheDocument()
  })

  it('va al dashboard cuando el alta deja sesion hecha', async () => {
    mockSignUp.mockResolvedValue({ ok: true, requireEmailVerification: false })

    render(<RegisterForm />)
    fillForm()
    submit()

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
    expect(screen.queryByText(/Verifica tu email/i)).not.toBeInTheDocument()
    expect(mockSignUp).toHaveBeenCalledWith(
      'ana@example.com',
      'Password1',
      'Ana Perez',
    )
  })

  it('traduce el codigo de email repetido del backend', async () => {
    // El backend contesta 409 AUTH_EMAIL_EXISTS: la cadena de Firebase
    // ('auth/email-already-in-use') no existe en este backend.
    mockSignUp.mockResolvedValue({
      ok: false,
      code: 'email_exists',
      statusCode: 409,
    })

    render(<RegisterForm />)
    fillForm()
    submit()

    expect(await screen.findByText('Este email ya está registrado')).toBeInTheDocument()
    expect(screen.queryByText(/Verifica tu email/i)).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('da un mensaje generico en un alta fallida y no filtra el del backend', async () => {
    mockSignUp.mockResolvedValue({
      ok: false,
      code: 'unexpected',
      statusCode: 500,
    })

    render(<RegisterForm />)
    fillForm()
    submit()

    expect(
      await screen.findByText(/no se pudo crear la cuenta/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/INTERNAL_ERROR/i)).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
