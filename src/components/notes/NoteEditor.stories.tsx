import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import NoteEditor from './NoteEditor'

const meta = {
  title: 'Formularios/Notas', component: NoteEditor,
  args: { onSave: fn(), onCancel: fn(), trips: [{ id: 'mock-trip', title: 'Lisboa, a tu ritmo' }] },
} satisfies Meta<typeof NoteEditor>
export default meta
type Story = StoryObj<typeof meta>
export const Empty: Story = {}
export const Dark: Story = { globals: { theme: 'dark' } }
export const Saving: Story = { args: { loading: true } }
export const Filled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText('Título *'), 'Antes de salir')
    await userEvent.type(canvas.getByLabelText('Contenido *'), 'Preparar documentos y revisar el alojamiento.')
    await userEvent.selectOptions(canvas.getByLabelText('Asociar a Viaje (Opcional)'), 'mock-trip')
    await expect(canvas.getByLabelText('Contenido *')).toHaveValue('Preparar documentos y revisar el alojamiento.')
  },
}
