import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, mocked, screen, userEvent, waitFor } from 'storybook/test'
import { useAuth } from '@/contexts/AuthContext'
import { createInsforgeClient } from '@/lib/insforge'
import type { TravelIdea } from '@/lib/travel-inspiration'
import FlightInspiration from './FlightInspiration'

const groundIdeas: TravelIdea[] = [
  {
    mode: 'ground', provider: 'transitous', origin: 'Madrid', destination: 'Barcelona',
    departureAt: '2026-11-15T08:13:00Z', arrivalAt: '2026-11-15T12:17:00Z', durationMinutes: 244,
    transfers: 2, lines: ['C3', 'AVE 0309'], modes: ['REGIONAL_RAIL', 'HIGHSPEED_RAIL'],
    price: null, deepLink: 'https://api.transitous.org/?toPlace=41.3874,2.1686', attribution: 'Transitous',
  } as unknown as TravelIdea,
  {
    mode: 'ground', provider: 'transitous', origin: 'Madrid', destination: 'Barcelona',
    departureAt: '2026-11-15T09:18:00Z', arrivalAt: '2026-11-15T12:44:00Z', durationMinutes: 206,
    transfers: 1, lines: ['C4a', 'AVE 0330'], modes: ['REGIONAL_RAIL', 'HIGHSPEED_RAIL'],
    price: null, deepLink: 'https://api.transitous.org/?toPlace=41.3874,2.1686', attribution: 'Transitous',
  } as unknown as TravelIdea,
]

const meta = {
  title: 'Trips/FlightInspiration',
  component: FlightInspiration,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/travel-inspiration' } } },
  beforeEach: () => {
    const invoke = fn(async (_slug: string, options: { body?: { mode?: string; checkOnly?: boolean } }) => {
      if (options?.body?.checkOnly) return { data: { status: 'available' }, error: null }
      if (options?.body?.mode === 'ground') return { data: { status: 'ready', ideas: groundIdeas }, error: null }
      return { data: { status: 'ready', ideas: [] }, error: null }
    })
    mocked(createInsforgeClient).mockReturnValue({ functions: { invoke } } as unknown as ReturnType<typeof createInsforgeClient>)
    mocked(useAuth).mockReturnValue({
      user: { id: 'story-user', email: 'viajero@example.com', full_name: 'Viajero' },
      loading: false, pending: false, sessionError: false, reloadSession: fn(), signIn: fn(),
      signOut: fn(), signUp: fn(), signInWithGoogle: fn(), resetPassword: fn(), verifyEmail: fn(),
      resendVerificationEmail: fn(), updateProfile: fn(), uploadAvatar: fn(),
    } as unknown as ReturnType<typeof useAuth>)
  },
} satisfies Meta<typeof FlightInspiration>

export default meta
type Story = StoryObj<typeof meta>

export const OfertasTerrestres: Story = {
  play: async () => {
    const botonTren = await screen.findByRole('button', { name: /Tren y bus|Train and bus/i })
    await userEvent.click(botonTren)
    await userEvent.type(await screen.findByLabelText(/Origen|Origin/i), 'Madrid')
    await userEvent.type(await screen.findByLabelText(/Destino|Destination/i), 'Barcelona')
    const fecha = await screen.findByLabelText(/Fecha de salida|Departure date/i)
    await userEvent.type(fecha, '2030-11-15')
    await userEvent.click(await screen.findByRole('button', { name: /Buscar ideas|Search ideas/i }))
    await waitFor(async () => expect(await screen.findAllByText(/AVE 0309/)).not.toHaveLength(0), { timeout: 5000 })
    expect(screen.getAllByText(/Precio no disponible|Price unavailable/i).length).toBe(2)
  },
}
