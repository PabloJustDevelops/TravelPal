import { act, render, screen, waitFor } from '@testing-library/react'
import TripPage from '../page'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { createInsforgeClient } from '@/lib/insforge'

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/components/layout/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/trips/EditTripModal', () => () => null)
jest.mock('@/components/trips/DeleteTripButton', () => () => null)
jest.mock('@/components/trips/TripJournal', () => () => null)
jest.mock('@/components/trips/TripSummary', () => () => null)
jest.mock('@/components/trips/TripItinerary', () => () => null)
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))

jest.mock('@/lib/insforge', () => ({
  createInsforgeClient: jest.fn(),
}))

const trip = {
  id: 'trip-1', user_id: 'user-1', title: 'Escapada a Roma', origin: 'Madrid',
  destination: 'Roma', departure_date: '2026-05-01T10:00:00.000Z',
  return_date: '2026-05-07T18:00:00.000Z', status: 'confirmed',
}
const mockRouter = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }

function setup(id: string | null, data: unknown = trip) {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' }, loading: false })
  ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(id === null ? '' : `id=${encodeURIComponent(id)}`))
  const chain: { select: jest.Mock; eq: jest.Mock; single: jest.Mock } = {} as {
    select: jest.Mock; eq: jest.Mock; single: jest.Mock
  }
  chain.select = jest.fn(() => chain)
  chain.eq = jest.fn(() => chain)
  chain.single = jest.fn(() => Promise.resolve({ data, error: null }))
  const from = jest.fn(() => chain)
  ;(createInsforgeClient as jest.Mock).mockReturnValue({ database: { from } })
  return { from, chain }
}

describe('ruta estática de detalle de viaje', () => {
  beforeEach(() => jest.clearAllMocks())

  it('lee el id de la query y carga el viaje en el cliente', async () => {
    const { from, chain } = setup('trip-1')
    render(<TripPage />)

    expect(await screen.findByRole('heading', { name: 'Escapada a Roma' })).toBeInTheDocument()
    await waitFor(() => expect(from).toHaveBeenCalledWith('trips'))
    expect(chain.eq).toHaveBeenCalledWith('id', 'trip-1')
  })

  it('muestra un estado accesible y no consulta si falta el id', async () => {
    const { from } = setup(null)
    render(<TripPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/selecciona un viaje/i)
    expect(from).not.toHaveBeenCalled()
  })

  it('muestra un estado accesible y no consulta si el id no es válido', async () => {
    const { from } = setup('   ')
    render(<TripPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/selecciona un viaje/i)
    expect(from).not.toHaveBeenCalled()
  })

  it('muestra el estado no encontrado si la consulta no devuelve el viaje', async () => {
    setup('missing-trip', null)
    render(<TripPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/viaje no encontrado/i)
  })

  it('oculta el viaje anterior mientras carga un nuevo id que no existe', async () => {
    const searchParamsMock = useSearchParams as jest.Mock
    let requestedId = ''
    let resolveMissing: ((result: { data: null; error: null }) => void) | undefined
    const missingResult = new Promise<{ data: null; error: null }>((resolve) => {
      resolveMissing = resolve
    })
    const chain: { select: jest.Mock; eq: jest.Mock; single: jest.Mock } = {} as {
      select: jest.Mock; eq: jest.Mock; single: jest.Mock
    }
    chain.select = jest.fn(() => chain)
    chain.eq = jest.fn((column: string, value: string) => {
      if (column === 'id') requestedId = value
      return chain
    })
    chain.single = jest.fn(() =>
      requestedId === 'trip-1'
        ? Promise.resolve({ data: trip, error: null })
        : missingResult,
    )
    ;(createInsforgeClient as jest.Mock).mockReturnValue({
      database: { from: jest.fn(() => chain) },
    })
    ;(useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' }, loading: false })
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    searchParamsMock.mockReturnValue(new URLSearchParams('id=trip-1'))

    const { rerender } = render(<TripPage />)
    expect(await screen.findByRole('heading', { name: 'Escapada a Roma' })).toBeInTheDocument()

    searchParamsMock.mockReturnValue(new URLSearchParams('id=missing-trip'))
    rerender(<TripPage />)

    expect(screen.queryByRole('heading', { name: 'Escapada a Roma' })).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Cargando viaje' })).toBeInTheDocument()

    await act(async () => {
      resolveMissing?.({ data: null, error: null })
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/viaje no encontrado/i)
  })

  it('ignora una respuesta tardía de otro id después de cargar el viaje actual', async () => {
    const searchParamsMock = useSearchParams as jest.Mock
    const resolvers = new Map<string, (result: { data: typeof trip; error: null }) => void>()
    let requestedId = ''
    const chain: { select: jest.Mock; eq: jest.Mock; single: jest.Mock } = {} as {
      select: jest.Mock; eq: jest.Mock; single: jest.Mock
    }
    chain.select = jest.fn(() => chain)
    chain.eq = jest.fn((column: string, value: string) => {
      if (column === 'id') requestedId = value
      return chain
    })
    chain.single = jest.fn(() => new Promise((resolve) => {
      resolvers.set(requestedId, resolve)
    }))
    ;(createInsforgeClient as jest.Mock).mockReturnValue({
      database: { from: jest.fn(() => chain) },
    })
    ;(useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' }, loading: false })
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    searchParamsMock.mockReturnValue(new URLSearchParams('id=trip-old'))

    const { rerender } = render(<TripPage />)
    await waitFor(() => expect(resolvers.has('trip-old')).toBe(true))

    searchParamsMock.mockReturnValue(new URLSearchParams('id=trip-current'))
    rerender(<TripPage />)
    await waitFor(() => expect(resolvers.has('trip-current')).toBe(true))

    await act(async () => {
      resolvers.get('trip-current')?.({
        data: { ...trip, id: 'trip-current', title: 'Viaje actual' },
        error: null,
      })
    })
    expect(await screen.findByRole('heading', { name: 'Viaje actual' })).toBeInTheDocument()

    await act(async () => {
      resolvers.get('trip-old')?.({
        data: { ...trip, id: 'trip-old', title: 'Respuesta antigua' },
        error: null,
      })
    })

    expect(screen.getByRole('heading', { name: 'Viaje actual' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Respuesta antigua' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Cargando viaje' })).not.toBeInTheDocument()
  })
})
