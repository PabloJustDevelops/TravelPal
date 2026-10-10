import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import Button from './Button'

const meta = { title: 'Sistema/Botón', component: Button, args: { children: 'Continuar planificación' } } satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>
export const Primary: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Outline: Story = { args: { variant: 'outline' } }
export const Dark: Story = { globals: { theme: 'dark' } }
