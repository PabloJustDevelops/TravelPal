import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ResetPasswordForm from '../ResetPasswordForm'
import { authService } from '@/lib/auth'

const mockReplace = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))
jest.mock('@/lib/auth', () => ({ authService: { updatePassword: jest.fn() } }))

const mockUpdatePassword = authService.updatePassword as jest.Mock

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
    target: { value: 'NuevaPassword123' },
  })
  fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
    target: { value: 'NuevaPassword123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = new URLSearchParams('token=secret-reset-token&insforge_status=ready')
    window.history.replaceState({}, '', '/reset-password?token=secret-reset-token&insforge_status=ready')
  })

  it('quita el token de la URL tras restablecer la contraseña correctamente', async () => {
    mockUpdatePassword.mockResolvedValue(undefined)
    render(<ResetPasswordForm />)
    await screen.findByRole('button', { name: 'Actualizar contraseña' })

    fillAndSubmit()

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledWith('NuevaPassword123', 'secret-reset-token'))
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(mockReplace).toHaveBeenCalledWith('/signin?message=password-updated')
  })

  it('conserva el token si falla el cambio para permitir reintentar', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdatePassword.mockRejectedValue(new Error('temporary failure'))
    render(<ResetPasswordForm />)
    await screen.findByRole('button', { name: 'Actualizar contraseña' })

    fillAndSubmit()

    await waitFor(() => expect(screen.getByText('temporary failure')).toBeInTheDocument())
    expect(window.location.search).toContain('token=secret-reset-token')
    expect(mockReplace).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
