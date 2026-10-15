import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GoogleButton from '../GoogleButton'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/lib/logger'

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

const signInWithGoogleMock = jest.fn()
const useAuthMock = useAuth as jest.Mock
const loggerErrorMock = logger.error as jest.Mock

describe('GoogleButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthMock.mockReturnValue({ signInWithGoogle: signInWithGoogleMock })
  })

  it('renderiza el botón de continuar con Google', () => {
    render(<GoogleButton />)

    expect(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeInTheDocument()
    expect(signInWithGoogleMock).not.toHaveBeenCalled()
  })

  it('inicia el acceso con Google desde el servicio de auth al pulsarlo', async () => {
    signInWithGoogleMock.mockResolvedValue(undefined)

    render(<GoogleButton />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    )

    await waitFor(() => {
      expect(signInWithGoogleMock).toHaveBeenCalledTimes(1)
    })
  })

  it('queda deshabilitado mientras la acción está en curso', async () => {
    let resolveAction = () => {}
    signInWithGoogleMock.mockImplementation(
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
    signInWithGoogleMock.mockRejectedValue(new Error('fallo del backend'))

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
    // El registro lleva el mensaje del error, no el objeto crudo.
    expect(loggerErrorMock).toHaveBeenCalledTimes(1)
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ error: 'fallo del backend' }),
    )
  })

  it('registra el mensaje del error, no "[object Error]"', async () => {
    signInWithGoogleMock.mockRejectedValue(new Error('fallo del backend'))

    render(<GoogleButton />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    )

    await waitFor(() => {
      expect(loggerErrorMock).toHaveBeenCalledTimes(1)
    })
    const [, context] = loggerErrorMock.mock.calls[0] as [
      string,
      { error: unknown },
    ]
    expect(context.error).toBe('fallo del backend')
    expect(context.error).not.toBe('[object Error]')
  })
})
