import { act, render, screen } from '@testing-library/react'
import Dashboard from './dashboard/page'
import Trips from './trips/page'
import Trip from './trip/page'
import CreateTrip from './create-trip/page'
import Planning from './planning/page'
import Tasks from './tasks/page'
import Expenses from './expenses/page'
import NewExpense from './expenses/new/page'
import EditExpense from './expense-edit/page'
import Notes from './notes/page'
import Profile from './profile/page'
import Settings from './settings/page'
import { useAuth } from '@/contexts/AuthContext'
import { createInsforgeClient } from '@/lib/insforge'

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }))
const mockRouter = { push: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, useSearchParams: () => new URLSearchParams('id=item-1'), usePathname: () => '/dashboard' }))
jest.mock('@/components/layout/Navbar', () => ({ __esModule: true, default: () => <nav aria-label="Navegación principal" /> }))
jest.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', setTheme: jest.fn() }) }))
jest.mock('@/components/ui/Toast', () => ({ useToast: () => ({ showSuccess: jest.fn(), showError: jest.fn() }) }))
jest.mock('react-calendar', () => ({ __esModule: true, default: () => <div>Calendario</div> }))
jest.mock('jspdf', () => ({ __esModule: true, default: jest.fn() }))

const queries = [
  ['dashboard', Dashboard], ['trips', Trips], ['trip', Trip], ['planning', Planning],
  ['tasks', Tasks], ['expenses', Expenses], ['expenses/new', NewExpense],
  ['expense-edit', EditExpense], ['notes', Notes],
] as const
const screens = [...queries, ['create-trip', CreateTrip], ['profile', Profile], ['settings', Settings]] as const

function deferQueries() {
  let resolve!: (result: { data: unknown; error: null }) => void
  const promise = new Promise<{ data: unknown; error: null }>(r => { resolve = r })
  const chain = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), neq: jest.fn(), gte: jest.fn(), limit: jest.fn(), single: jest.fn(), then: promise.then.bind(promise) }
  for (const method of ['select', 'eq', 'order', 'neq', 'gte', 'limit', 'single'] as const) chain[method].mockReturnValue(chain)
  const from = jest.fn(() => chain)
  jest.mocked(createInsforgeClient).mockReturnValue({ database: { from } } as unknown as ReturnType<typeof createInsforgeClient>)
  return { from, resolve }
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(useAuth).mockReturnValue({ user: { id: 'u1', email: 'test@example.com' }, loading: false } as ReturnType<typeof useAuth>)
})
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.clearAllMocks() })

it.each(queries)('%s mantiene el skeleton durante la consulta SDK pendiente y lo retira al resolver', async (name, Page) => {
  const query = deferQueries()
  render(<Page />)
  await act(async () => {})
  expect(query.from).toHaveBeenCalled()
  expect(screen.queryByTestId('page-skeleton')).not.toBeInTheDocument()
  await act(async () => { jest.advanceTimersByTime(120) })
  expect(screen.getByTestId('page-skeleton')).toHaveAttribute('data-screen', name)
  expect(screen.queryByText(/Inicia sesión/)).not.toBeInTheDocument()
  await act(async () => { query.resolve({ data: null, error: null }) })
  expect(screen.queryByTestId('page-skeleton')).not.toBeInTheDocument()
})
it.each(screens)('%s espera la sesión sin mostrar datos privados ni errores de login', async (name, Page) => {
  jest.mocked(useAuth).mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>)
  const query = deferQueries()
  render(<Page />)
  await act(async () => { jest.advanceTimersByTime(120) })
  expect(screen.getByTestId('page-skeleton')).toHaveAttribute('data-screen', name)
  expect(screen.queryByText(/Inicia sesión/)).not.toBeInTheDocument()
  expect(query.from).not.toHaveBeenCalled()
})
it.each(queries)('%s evita el flash si el SDK responde antes del umbral', async (_name, Page) => {
  const query = deferQueries()
  render(<Page />)
  await act(async () => { query.resolve({ data: null, error: null }) })
  await act(async () => { jest.advanceTimersByTime(119) })
  expect(screen.queryByTestId('page-skeleton')).not.toBeInTheDocument()
})
it('mantiene el mismo umbral al pasar de la sesión a la consulta de datos', async () => {
  jest.mocked(useAuth).mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>)
  const query = deferQueries()
  const { rerender } = render(<Trips />)
  await act(async () => { jest.advanceTimersByTime(120) })
  expect(screen.getByTestId('page-skeleton')).toBeInTheDocument()
  jest.mocked(useAuth).mockReturnValue({ user: { id: 'u1' }, loading: false } as ReturnType<typeof useAuth>)
  rerender(<Trips />)
  expect(query.from).toHaveBeenCalledWith('trips')
  expect(screen.getByTestId('page-skeleton')).toBeInTheDocument()
  await act(async () => { query.resolve({ data: [], error: null }) })
  expect(screen.queryByTestId('page-skeleton')).not.toBeInTheDocument()
  expect(screen.getByText('No tienes viajes registrados')).toBeInTheDocument()
})
