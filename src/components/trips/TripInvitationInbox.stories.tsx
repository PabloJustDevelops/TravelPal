import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, mocked, within } from 'storybook/test'
import { createInsforgeClient } from '@/lib/insforge'
import TripInvitationInbox from './TripInvitationInbox'

const invitations = [
  { id: 'inv-1', trip_id: 'trip-1', trip_title: 'Lisboa en mayo', role: 'editor' as const, state: 'pending' as const, created_at: '2026-10-26T10:00:00Z', invited_by_email: 'ana@example.com' },
  { id: 'inv-2', trip_id: 'trip-2', trip_title: 'Ruta por el norte', role: 'reader' as const, state: 'pending' as const, created_at: '2026-10-25T09:00:00Z', invited_by_email: 'luis@example.com' },
]

const meta = {
  title: 'Trips/TripInvitationInbox',
  component: TripInvitationInbox,
  args: { onAccepted: fn() },
  beforeEach: () => {
    const invoke = fn().mockResolvedValue({ data: { invitations }, error: null })
    mocked(createInsforgeClient).mockReturnValue({ functions: { invoke } } as unknown as ReturnType<typeof createInsforgeClient>)
  },
} satisfies Meta<typeof TripInvitationInbox>

export default meta
type Story = StoryObj<typeof meta>

export const ConInvitaciones: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(await canvas.findByText('Lisboa en mayo')).toBeInTheDocument()
    expect(canvas.getByText('Ruta por el norte')).toBeInTheDocument()
    expect(canvas.getAllByRole('button', { name: 'Aceptar' })).toHaveLength(2)
  },
}

export const Vacia: Story = {
  beforeEach: () => {
    const invoke = fn().mockResolvedValue({ data: { invitations: [] }, error: null })
    mocked(createInsforgeClient).mockReturnValue({ functions: { invoke } } as unknown as ReturnType<typeof createInsforgeClient>)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(canvas.queryByText('Invitaciones pendientes')).not.toBeInTheDocument()
    expect(canvasElement.textContent).toBe('')
  },
}
