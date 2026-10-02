import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GoogleButton from '../GoogleButton'
import { initiateOAuthAction } from '@/lib/insforge/auth-actions'
import { logger } from '@/lib/logger'

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
const loggerErrorMock = logger.error as jest.Mock

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
    // El registro lleva el mensaje del error, no el objeto crudo.
    expect(loggerErrorMock).toHaveBeenCalledTimes(1)
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ error: 'fallo del backend' }),
    )
  })

  it('no trata el error de redirección de Next como un fallo', async () => {
    // redirect() de Next no devuelve: lanza un error de control de flujo con
    // digest NEXT_REDIRECT mientras el router navega al proveedor. No es un
    // fallo de la app, así que no debe registrarse ni mostrarse.
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;push;https://accounts.google.test/o/authorize;307;',
    })
    initiateOAuthActionMock.mockRejectedValue(redirectError)

    render(<GoogleButton />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Continuar con Google' }),
      ).toBeEnabled()
    })
    expect(loggerErrorMock).not.toHaveBeenCalled()
    expect(
      screen.queryByText(/no se pudo conectar con google/i),
    ).not.toBeInTheDocument()
  })

  it('registra el mensaje del error, no "[object Error]"', async () => {
    initiateOAuthActionMock.mockRejectedValue(new Error('fallo del backend'))

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
