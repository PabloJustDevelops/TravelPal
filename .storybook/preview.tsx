import type { Preview } from '@storybook/nextjs-vite'
import { Inter, Fraunces } from 'next/font/google'
import '../src/app/globals.css'
import { sb } from 'storybook/test'

sb.mock(import('../src/contexts/AuthContext.tsx'))
sb.mock(import('../src/lib/insforge.ts'))

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Tema de TravelPal',
      toolbar: { icon: 'circlehollow', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [(Story, context) => {
    document.documentElement.classList.add(inter.variable, fraunces.variable)
    document.documentElement.classList.toggle('dark', context.globals.theme === 'dark')
    const Container = context.parameters.hasMain ? 'div' : 'main'
    return <Container className="min-h-screen bg-paper text-ink font-sans p-6"><Story /></Container>
  }],
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
  },
}
export default preview
