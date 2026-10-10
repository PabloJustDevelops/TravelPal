import { fireEvent, render, screen } from '@testing-library/react'
import SettingsPage from '../page'
import { usePushNotifications } from '@/hooks/usePushNotifications'

jest.mock('@/components/layout/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: jest.fn() }),
}))
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showSuccess: jest.fn(), showError: jest.fn() }),
}))
jest.mock('@/hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }))

const pushState = {
  supported: true,
  permission: 'granted' as const,
  subscribed: false,
  busy: false,
  error: null,
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(usePushNotifications).mockReturnValue({ ...pushState })
})

it('explica que el envio no esta disponible y no ofrece activar avisos inexistentes', () => {
  render(<SettingsPage />)
  expect(screen.getByText(/los avisos fuera de la app todavía no están disponibles/i)).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: /notificaciones push/i })).toBeDisabled()
})

it('permite quitar una suscripcion anterior sin prometer que recibe avisos', () => {
  jest.mocked(usePushNotifications).mockReturnValue({ ...pushState, subscribed: true })
  render(<SettingsPage />)
  expect(screen.getByText(/todavía no recibe avisos/i)).toBeInTheDocument()
  const toggle = screen.getByRole('switch', { name: /notificaciones push/i })
  expect(toggle).toBeEnabled()
  fireEvent.click(toggle)
  expect(pushState.unsubscribe).toHaveBeenCalledTimes(1)
})
