import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GoogleButton from '../GoogleButton'
import { initiateOAuthAction } from '@/lib/insforge/auth-actions'

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

const initiateOAuthActionMock = initiateOAuthAction as jest.Mock

describe('GoogleButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renderiza el botón de continuar con Google', () => {
    render(<GoogleButton />)

    expect(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeInTheDocument()
    expect(initiateOAuthActionMock).not.toHaveBeenCalled()
  })

  it('llama a la acción del servidor con google al pulsarlo', async () => {
    initiateOAuthActionMock.mockResolvedValue(undefined)

    render(<GoogleButton />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    )

    await waitFor(() => {
      expect(initiateOAuthActionMock).toHaveBeenCalledTimes(1)
      expect(initiateOAuthActionMock).toHaveBeenCalledWith('google')
    })
  })

  it('queda deshabilitado mientras la acción está en curso', async () => {
    let resolveAction = () => {}
    initiateOAuthActionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve
        }),
    )

    render(<GoogleButton />)
    const button = screen.getByRole('button', { name: 'Continuar con Google' })
    fireEvent.click(button)

    expect(button).toBeDisabled()

    resolveAction()
    await waitFor(() => {
      expect(button).toBeEnabled()
    })
  })

  it('muestra el fallo y reactiva el botón si la acción no arranca', async () => {
    initiateOAuthActionMock.mockRejectedValue(new Error('fallo del backend'))

    render(<GoogleButton />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    )

    expect(
      await screen.findByText(/no se pudo conectar con google/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeEnabled()
  })
})
