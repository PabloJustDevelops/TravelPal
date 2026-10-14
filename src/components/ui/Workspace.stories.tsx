import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ExpenseCard from '@/components/expenses/ExpenseCard'
import NoteCard from '@/components/notes/NoteCard'
import PageTitle from './PageTitle'
import EmptyState from './EmptyState'
import Button from './Button'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

const onEdit = fn()
const note = {
  id: 'story-note', user_id: 'story-user', title: 'Antes de salir',
  content: 'Guardar los billetes del tren y la dirección del alojamiento para consultarlos sin conexión. La entrada es a partir de las 15:00.',
  category: 'general', tags: [], is_favorite: false,
  created_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-13T12:00:00Z',
}
function Collections() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageTitle title="Gastos" subtitle="Lo que has gastado, viaje a viaje." action={<Button>Nuevo gasto</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        <ExpenseCard expense={{ id: 'story-expense', user_id: 'story-user', title: 'Tren a Lisboa', description: 'Tren a Lisboa', amount: 74, currency: 'EUR', category: 'transport', date: '2026-10-18', created_at: '', updated_at: '' }} />
        <ExpenseCard expense={{ id: 'story-stay', user_id: 'story-user', title: 'Tres noches en Alfama', description: 'Tres noches en Alfama', amount: 280, currency: 'EUR', category: 'accommodation', date: '2026-10-18', created_at: '', updated_at: '' }} />
      </div>
      <PageTitle title="Notas" subtitle="Direcciones, ideas y detalles para tener a mano." action={<Button>Nueva nota</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        <NoteCard note={note} onEdit={onEdit} />
        <NoteCard note={{ ...note, id: 'story-restaurant', title: 'Dónde comer', category: 'restaurant', content: 'Buscar un restaurante cerca del mirador para la primera noche. Revisar el horario antes de ir.' }} onEdit={onEdit} />
      </div>
    </div>
  )
}
const meta = { title: 'Sistema/Espacio de trabajo', component: Collections } satisfies Meta<typeof Collections>
export default meta
type Story = StoryObj<typeof meta>
export const CollectionsLight: Story = {}
export const CollectionsDark: Story = { globals: { theme: 'dark' } }
const mobileParameters = {
  viewport: { options: { travelPal390: { name: 'TravelPal 390 × 844', styles: { width: '390px', height: '844px' }, type: 'mobile' } } },
}
export const Mobile390: Story = {
  parameters: mobileParameters,
  globals: { viewport: { value: 'travelPal390', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(390)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    const canvas = within(canvasElement)
    for (const control of [...canvas.getAllByRole('link'), ...canvas.getAllByRole('button', { name: /Editar nota/ })]) {
      const bounds = control.getBoundingClientRect()
      await expect(bounds.width).toBeGreaterThanOrEqual(44)
      await expect(bounds.height).toBeGreaterThanOrEqual(44)
      await expect(bounds.right).toBeLessThanOrEqual(390)
      await expect(getComputedStyle(control).opacity).toBe('1')
    }
  },
}
export const MobileDark: Story = {
  ...Mobile390,
  globals: { theme: 'dark', viewport: { value: 'travelPal390', isRotated: false } },
}
export const Empty: Story = {
  render: () => <div className="mx-auto max-w-5xl space-y-8"><PageTitle title="Notas" /><EmptyState icon={<DocumentTextIcon className="h-6 w-6" />} title="Tus ideas, a mano" description="Guarda una dirección, una recomendación o algo que quieras recordar del viaje." action={<Button>Nueva nota</Button>} /></div>,
}
export const EditNote: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const buttons = canvas.getAllByRole('button', { name: /Editar nota/ })
    await userEvent.tab()
    for (const button of buttons) {
      const bounds = button.getBoundingClientRect()
      await expect(bounds.width).toBeGreaterThanOrEqual(44)
      await expect(bounds.height).toBeGreaterThanOrEqual(44)
    }
    await userEvent.click(buttons[0])
    await expect(onEdit).toHaveBeenCalledWith(note)
  },
}
