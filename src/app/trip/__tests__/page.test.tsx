import { render, screen, waitFor } from '@testing-library/react'
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
})
