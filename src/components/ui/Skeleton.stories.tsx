import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Skeleton, SkeletonCard, SkeletonText } from './Skeleton'

const meta = { title: 'Sistema/Skeleton', component: Skeleton, parameters: { a11y: { test: 'error' } } } satisfies Meta<typeof Skeleton>
export default meta
type Story = StoryObj<typeof meta>
export const Block: Story = { args: { className: 'h-12 w-64' } }
export const Text: Story = { render: () => <div className="max-w-md"><SkeletonText lines={4} /></div> }
export const Card: Story = { render: () => <div className="max-w-md"><SkeletonCard /></div> }
