import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerifyEmailStep from '../VerifyEmailStep'
import { useAuth } from '@/contexts/AuthContext'

const mockReplace = jest.fn()
const mockVerifyEmail = jest.fn()
const mockResendVerificationEmail = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockReplace }),
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const typeCode = (code: string) => {
  const inputs = screen.getAllByLabelText(/Dígito \d del código/i)
  code.split('').forEach((digit, index) => {
    fireEvent.change(inputs[index], { target: { value: digit } })
  })
}

const submit = () => {
  const form = screen
    .getByRole('button', { name: /verificar cuenta/i })
    .closest('form')
  fireEvent.submit(form as HTMLFormElement)
}

describe('VerifyEmailStep', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({
      verifyEmail: mockVerifyEmail,
      resendVerificationEmail: mockResendVerificationEmail,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('verifica el codigo y navega al dashboard', async () => {
    mockVerifyEmail.mockResolvedValue({ id: 'user-123' })

    render(<VerifyEmailStep email="ana@example.com" />)
    typeCode('123456')
    submit()

    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith('ana@example.com', '123456')
    })
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('muestra el mensaje del backend y no navega si el codigo no vale', async () => {
    mockVerifyEmail.mockRejectedValue(
      new Error('Invalid or expired verification code'),
    )

    render(<VerifyEmailStep email="ana@example.com" />)
    typeCode('000000')
    submit()

    expect(
      await screen.findByText('Invalid or expired verification code'),
    ).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('no deja verificar hasta tener los 6 digitos', () => {
    render(<VerifyEmailStep email="ana@example.com" />)

    typeCode('12345')

    expect(screen.getByRole('button', { name: /verificar cuenta/i })).toBeDisabled()
  })

  it('reenvia el codigo y arranca el contador del backend', async () => {
    jest.useFakeTimers()
    mockResendVerificationEmail.mockResolvedValue(undefined)

    render(<VerifyEmailStep email="ana@example.com" />)

    const resendButton = screen.getByRole('button', { name: /reenviar código/i })
    // El correo del alta acaba de salir: el reenvio espera al min_interval_seconds.
    expect(resendButton).toBeDisabled()
    expect(resendButton).toHaveTextContent('Reenviar código en 60 s')

    for (let second = 0; second < 60; second++) {
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
    }

    await act(async () => {
      fireEvent.click(resendButton)
    })

    expect(mockResendVerificationEmail).toHaveBeenCalledWith('ana@example.com')
    expect(
      screen.getByText('Te hemos enviado un código nuevo.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /reenviar código en 60 s/i }),
    ).toBeDisabled()
  })

  it('muestra el error del backend si el reenvio falla', async () => {
    jest.useFakeTimers()
    mockResendVerificationEmail.mockRejectedValue(
      new Error('Please wait before requesting another email'),
    )

    render(<VerifyEmailStep email="ana@example.com" />)

    for (let second = 0; second < 60; second++) {
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reenviar código/i }))
    })

    expect(
      screen.getByText('Please wait before requesting another email'),
    ).toBeInTheDocument()
  })
})
