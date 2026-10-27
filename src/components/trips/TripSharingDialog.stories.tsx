import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, mocked, screen, userEvent } from 'storybook/test'
import { createInsforgeClient } from '@/lib/insforge'
import TripSharingDialog from './TripSharingDialog'

const members = [
  { trip_id: 'trip-1', user_id: 'user-ana', role: 'editor' as const, email: 'ana@example.com' },
  { trip_id: 'trip-1', user_id: 'user-luis', role: 'reader' as const, email: 'luis@example.com' },
]
const invitations = [
  { id: 'inv-1', trip_id: 'trip-1', invited_user_id: 'user-marta', role: 'editor' as const, state: 'pending' as const, created_at: '2026-10-26T10:00:00Z', email: 'marta@example.com' },
]

const meta = {
  title: 'Trips/TripSharingDialog',
  component: TripSharingDialog,
  args: { tripId: 'trip-1', isOpen: true, onClose: fn() },
  beforeEach: () => {
    const invoke = fn().mockResolvedValue({ data: { members, invitations }, error: null })
    mocked(createInsforgeClient).mockReturnValue({ functions: { invoke } } as unknown as ReturnType<typeof createInsforgeClient>)
  },
} satisfies Meta<typeof TripSharingDialog>

export default meta
type Story = StoryObj<typeof meta>

export const ConMiembros: Story = {
  play: async () => {
    // El diálogo vive en un portal fuera del canvas del story: hay que mirar document.body.
    const canvas = screen
    expect(await canvas.findByText('Compartir viaje')).toBeInTheDocument()
    expect(await canvas.findByText('ana@example.com')).toBeInTheDocument()
    expect(canvas.getByText('luis@example.com')).toBeInTheDocument()
  },
}

export const InvitacionEnviada: Story = {
  play: async () => {
    // El diálogo vive en un portal fuera del canvas del story: hay que mirar document.body.
    const canvas = screen
    const email = await canvas.findByLabelText('Invitar por correo electrónico')
    await userEvent.type(email, 'nueva@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Enviar invitación' }))
    expect(await canvas.findByText(/Si existe una cuenta para ese correo/)).toBeInTheDocument()
  },
}
