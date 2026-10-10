import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TaskModal } from './TaskModal'

const meta = {
  title: 'Formularios/Tareas', component: TaskModal,
  args: { isOpen: true, onClose: fn(), onSave: fn() },
} satisfies Meta<typeof TaskModal>
export default meta
type Story = StoryObj<typeof meta>
export const Empty: Story = {}
export const Dark: Story = { globals: { theme: 'dark' } }
export const RequiredError: Story = {
  play: async () => {
    const body = within(document.body)
    await userEvent.click(await body.findByRole('button', { name: 'Guardar' }))
    await expect(await body.findByRole('alert')).toHaveTextContent('El título es obligatorio')
  },
}
