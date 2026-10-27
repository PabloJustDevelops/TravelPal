import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test'
import Dashboard from '@/app/dashboard/page'
import Trips from '@/app/trips/page'
import Planning from '@/app/planning/page'
import Tasks from '@/app/tasks/page'
import Expenses from '@/app/expenses/page'
import Notes from '@/app/notes/page'
import Profile from '@/app/profile/page'
import Settings from '@/app/settings/page'
import { useAuth } from '@/contexts/AuthContext'
import { createInsforgeClient } from '@/lib/insforge'
import { ToastProvider } from './Toast'
import Button from './Button'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type { InteriorScreen } from './InteriorSkeleton'

const pages = { dashboard: Dashboard, trips: Trips, planning: Planning, tasks: Tasks, expenses: Expenses, notes: Notes, profile: Profile, settings: Settings }
let resolveData: () => void

function PendingPage({ screen }: { screen: keyof typeof pages; fixture?: 'empty' | 'populated' | 'long' }) {
  const [, setRevision] = useState(0)
  const Page = pages[screen]
  return <ToastProvider><ThemeProvider><Page /><Button data-qa-resolve type="button" className="fixed bottom-2 right-2 z-[300] rounded border border-line bg-paper p-2 text-ink" onClick={() => { resolveData(); setRevision(value => value + 1) }}>Resolver datos de prueba</Button></ThemeProvider></ToastProvider>
}

const meta = {
  title: 'Interior/Carga', component: PendingPage,
  parameters: { hasMain: true, nextjs: { appDirectory: true, navigation: { pathname: '/dashboard' } } },
  decorators: [(Story) => <div className="-m-6"><Story /></div>],
  beforeEach: ({ args }) => {
    const auth = { user: { id: 'story-user', email: 'viajero@example.com', full_name: 'Viajero' }, loading: false, pending: false, sessionError: false, reloadSession: fn(), signIn: fn(), signOut: fn(), signUp: fn(), signInWithGoogle: fn(), resetPassword: fn(), verifyEmail: fn(), resendVerificationEmail: fn(), updateProfile: fn(), uploadAvatar: fn() }
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    // Datos sintéticos exclusivos del arnés. No se incorporan a la app.
    const trip = { id: 'story-trip', user_id: 'story-user', title: 'Escapada a Lisboa', origin: 'Madrid', destination: 'Lisboa', departure_date: '2030-05-10', return_date: '2030-05-14', status: 'confirmed', created_at: '', updated_at: '' }
    const fixtures: Record<string, unknown[]> = {
      trips: [trip],
      expenses: [{ id: 'story-expense', user_id: 'story-user', trip_id: trip.id, title: 'Billete de tren', description: 'Billete de tren', amount: 74, currency: 'EUR', category: 'transport', date: '2030-05-10', created_at: '', updated_at: '' }],
      notes: [{ id: 'story-note', user_id: 'story-user', title: 'Antes de salir', content: 'Guardar los billetes para el viaje.', tags: [], category: 'general', is_favorite: false, created_at: '2030-05-01', updated_at: '2030-05-01' }],
      tasks: [], budgets: [], itinerary_activities: [], bookings: [], alerts: [],
    }
    if (args.fixture === 'long') {
      fixtures.trips = Array.from({ length: 12 }, (_, i) => ({ ...trip, id: i === 0 ? trip.id : `trip-${i}` }))
      fixtures.notes = Array.from({ length: 12 }, (_, i) => ({ ...fixtures.notes[0] as object, id: `note-${i}` }))
      fixtures.expenses = Array.from({ length: 12 }, (_, i) => ({ ...fixtures.expenses[0] as object, id: `expense-${i}` }))
      fixtures.budgets = Array.from({ length: 3 }, (_, i) => ({ id: `budget-${i}`, user_id: 'story-user', trip_id: trip.id, name: `Presupuesto ${i + 1}`, total_amount: 1000, spent_amount: 0, currency: 'EUR', category: 'travel', start_date: '2030-05-01', end_date: '2030-05-31', created_at: '', updated_at: '' }))
      fixtures.tasks = Array.from({ length: 3 }, (_, i) => ({ id: `task-${i}`, title: `Preparar documentación ${i + 1}`, status: 'pending', due_date: '2030-05-09' }))
      fixtures.itinerary_activities = Array.from({ length: 3 }, (_, i) => ({ id: `activity-${i}`, trip_id: trip.id, date: '2030-05-10', title: `Paseo por Lisboa ${i + 1}`, description: 'Recorrer el centro de la ciudad.', start_time: '10:00', location: 'Lisboa', completed: false }))
    }
    const from = fn((table: string) => {
      const result = pending.then(() => ({ data: args.fixture !== 'empty' ? fixtures[table] ?? [] : [], error: null }))
      const chain = { select: fn(), eq: fn(), order: fn(), neq: fn(), gte: fn(), limit: fn(), abortSignal: fn(), then: result.then.bind(result) }
      for (const method of ['select', 'eq', 'order', 'neq', 'gte', 'limit', 'abortSignal'] as const) chain[method].mockReturnValue(chain)
      return chain
    })
    mocked(useAuth).mockReturnValue(auth)
    const invoke = fn().mockResolvedValue({ data: { invitations: [], members: [] }, error: null })
    mocked(createInsforgeClient).mockReturnValue({ database: { from }, functions: { invoke } } as unknown as ReturnType<typeof createInsforgeClient>)
    resolveData = () => { finish(); mocked(useAuth).mockReturnValue({ ...auth, loading: false }) }
  },
} satisfies Meta<typeof PendingPage>
export default meta
type Story = StoryObj<typeof meta>
const pendingStory = (screen: keyof typeof pages): Story => ({
  args: { screen, fixture: 'empty' },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: `/${screen}` } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(await canvas.findByTestId('page-skeleton')).toHaveAttribute('data-screen', screen satisfies InteriorScreen)
  },
})
export const DashboardPending: Story = pendingStory('dashboard')
export const TripsPending: Story = pendingStory('trips')
export const PlanningPending: Story = pendingStory('planning')
export const TasksPending: Story = pendingStory('tasks')
export const ExpensesPending: Story = pendingStory('expenses')
export const NotesPending: Story = pendingStory('notes')
// Estas pantallas esperan solo la consulta de sesión.
export const ProfilePending: Story = { ...pendingStory('profile'), play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await canvas.findByTestId('page-skeleton')
  await userEvent.click(canvas.getByRole('button', { name: 'Resolver datos de prueba' }))
  await waitFor(() => expect(canvas.queryByTestId('page-skeleton')).not.toBeInTheDocument())
  expect(canvas.getByRole('heading', { name: 'Tu perfil' })).toBeInTheDocument()
}, beforeEach: () => mocked(useAuth).mockReturnValue({ ...mocked(useAuth)(), user: null, loading: true }) }
export const SettingsPending: Story = { ...pendingStory('settings'), play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await canvas.findByTestId('page-skeleton')
  await userEvent.click(canvas.getByRole('button', { name: 'Resolver datos de prueba' }))
  await waitFor(() => expect(canvas.queryByTestId('page-skeleton')).not.toBeInTheDocument())
  expect(canvas.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
}, beforeEach: () => mocked(useAuth).mockReturnValue({ ...mocked(useAuth)(), user: null, loading: true }) }

const fidelityStory = (screen: keyof typeof pages): Story => ({
  ...pendingStory(screen),
  args: { screen, fixture: 'long' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByTestId('page-skeleton')
    await document.fonts.ready
    const frame = canvasElement.querySelector('[data-loading-frame]')!
    const main = frame.closest('main')!
    const height = main.getBoundingClientRect().height
    const slots = [...frame.querySelectorAll<HTMLElement>('[data-loading-slot]')].map(element => ({
      name: element.dataset.loadingSlot,
      height: element.getBoundingClientRect().height,
      top: element.getBoundingClientRect().top,
    }))
    await userEvent.click(canvas.getByRole('button', { name: 'Resolver datos de prueba' }))
    await waitFor(() => expect(canvas.queryByTestId('page-skeleton')).not.toBeInTheDocument())
    expect(Math.abs(main.getBoundingClientRect().height - height)).toBeLessThanOrEqual(height * .05)
    for (const slot of slots) {
      const element = frame.querySelector(`[data-loading-slot="${slot.name}"]`)!
      expect(element).not.toBeNull()
      expect(Math.abs(element.getBoundingClientRect().height - slot.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(element.getBoundingClientRect().top - slot.top)).toBeLessThanOrEqual(1)
    }
    if (screen === 'dashboard') {
      await userEvent.click(canvas.getByRole('button', { name: 'Exportar' }))
      for (const label of ['Exportar JSON', 'Exportar PDF']) {
        const action = await canvas.findByRole('menuitem', { name: label })
        const rect = action.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        expect(rect.width).toBeGreaterThan(0)
        expect(rect.height).toBeGreaterThan(0)
        expect(hit).not.toBeNull()
        expect(action.contains(hit)).toBe(true)
      }
    }
  },
})
export const DashboardFidelity: Story = fidelityStory('dashboard')
export const DashboardEmptyFidelity: Story = {
  ...fidelityStory('dashboard'),
  args: { screen: 'dashboard', fixture: 'empty' },
}
export const ExpensesFidelity: Story = fidelityStory('expenses')
export const TripsFidelity: Story = fidelityStory('trips')
export const PlanningFidelity: Story = fidelityStory('planning')
export const TasksFidelity: Story = fidelityStory('tasks')
export const NotesFidelity: Story = fidelityStory('notes')
