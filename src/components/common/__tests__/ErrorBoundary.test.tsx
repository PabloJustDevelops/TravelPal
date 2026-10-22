import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'
import { captureClientException } from '@/lib/sentry'
jest.mock('@/lib/sentry', () => ({ captureClientException: jest.fn(() => 'event-123') }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))
beforeEach(() => { jest.clearAllMocks() })
const broken = new Error('broken')
function Broken(): React.ReactNode { throw broken }
it.each([undefined, <div key="custom">custom fallback</div>])('shows the searchable id even with a custom fallback', (fallback) => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  const callback = jest.fn()
  render(<ErrorBoundary fallback={fallback} onError={callback}><Broken /></ErrorBoundary>)
  expect(screen.getByText(/event-123/)).toBeInTheDocument()
  expect(captureClientException).toHaveBeenCalledWith(broken)
  expect(captureClientException).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledTimes(1)
  consoleError.mockRestore()
})
