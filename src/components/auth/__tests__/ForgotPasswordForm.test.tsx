import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ForgotPasswordForm from '../ForgotPasswordForm'
import { useAuth } from '@/contexts/AuthContext'

const mockResetPassword = jest.fn()

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const submit = () => {
  const form = screen
    .getByRole('button', { name: /enviar enlace de recuperación/i })
    .closest('form')
  fireEvent.submit(form as HTMLFormElement)
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ resetPassword: mockResetPassword })
  })

  it('pide el enlace y muestra el aviso de enviado', async () => {
    mockResetPassword.mockResolvedValue(undefined)

    render(<ForgotPasswordForm />)
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'ana@example.com' },
    })
    submit()

    expect(await screen.findByText(/email enviado/i)).toBeInTheDocument()
    expect(mockResetPassword).toHaveBeenCalledWith('ana@example.com')
  })

  it('no revela si el email existe ni filtra el texto del backend', async () => {
    // El backend puede contestar por el email (existe o no) o por el limite de
    // envios: el formulario no debe dejar ver cual de las dos cosas ha pasado.
    mockResetPassword.mockRejectedValue(
      new Error('Error al enviar email de recuperación: User not found'),
    )

    render(<ForgotPasswordForm />)
    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), {
      target: { value: 'nadie@example.com' },
    })
    submit()

    expect(
      await screen.findByText(/no hemos podido enviar el email/i),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/user not found/i)).not.toBeInTheDocument()
    })
  })
})
