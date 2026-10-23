import { fireEvent, render, screen } from '@testing-library/react'
import SettingsPage from '../page'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useTheme } from '@/contexts/ThemeContext'

jest.mock('@/components/layout/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/contexts/ThemeContext', () => ({ useTheme: jest.fn() }))
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showSuccess: jest.fn(), showError: jest.fn() }),
}))
jest.mock('@/hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }))

const pushState = {
  supported: true,
  configured: true,
  permission: 'granted' as const,
  subscribed: false,
  busy: false,
  error: null,
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useTheme).mockReturnValue({theme:'light',resolvedTheme:'light',setTheme:jest.fn()})
  jest.mocked(usePushNotifications).mockReturnValue({ ...pushState })
})

it('permite elegir el tema automático explícitamente', () => {
  render(<SettingsPage />)
  fireEvent.click(screen.getByRole('radio',{name:/Automático/}))
  expect(useTheme().setTheme).toHaveBeenCalledWith('system')
})

it('permite activar los avisos cuando hay soporte y clave pública', () => {
  render(<SettingsPage />)
  const toggle = screen.getByRole('switch', { name: /notificaciones push/i })
  expect(toggle).toBeEnabled()
  fireEvent.click(toggle)
  expect(pushState.subscribe).toHaveBeenCalledTimes(1)
})

it('permite quitar una suscripción del navegador', () => {
  jest.mocked(usePushNotifications).mockReturnValue({ ...pushState, subscribed: true })
  render(<SettingsPage />)
  const toggle = screen.getByRole('switch', { name: /notificaciones push/i })
  expect(toggle).toBeEnabled()
  fireEvent.click(toggle)
  expect(pushState.unsubscribe).toHaveBeenCalledTimes(1)
})

it('sin clave pública mantiene el alta deshabilitada', () => {
  jest.mocked(usePushNotifications).mockReturnValue({ ...pushState, configured: false })
  render(<SettingsPage />)
  expect(screen.getByRole('switch', { name: /notificaciones push/i })).toBeDisabled()
  expect(screen.getByText(/no están configuradas/i)).toBeInTheDocument()
})
