import { fireEvent, render, screen } from '@testing-library/react'
import TopBar from '../TopBar'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/dashboard',
}))

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', full_name: 'Pablo', email: 'pablo@example.com' },
    signOut: jest.fn(),
  }),
}))

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ locale: 'es', t: (key: string) => key }),
}))

// Campana de mentira que respeta el contrato de la real: recibe `open` y avisa por `onOpenChange`.
// Sin boton nativo a proposito: el sistema de diseno lleva una lista blanca explicita de ellos.
jest.mock('@/components/notifications/NotificationSystem', () => ({
  __esModule: true,
  default: ({ open, onOpenChange }: { open?: boolean; onOpenChange?: (next: boolean) => void }) => (
    <div>
      <span onClick={() => onOpenChange?.(!open)}>campana</span>
      {open ? <div data-testid="panel-notificaciones">Notificaciones</div> : null}
    </div>
  ),
}))

const noop = () => {}

function renderBar() {
  return render(
    <TopBar mobileMenuOpen={false} onMobileMenuToggle={noop} mobileToggleRef={{ current: null }} />,
  )
}

describe('TopBar: desplegables excluyentes', () => {
  it('abre el menu de usuario y cierra el panel de notificaciones', () => {
    renderBar()
    fireEvent.click(screen.getByText('campana'))
    expect(screen.getByTestId('panel-notificaciones')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'profileMenu' }))

    expect(screen.queryByTestId('panel-notificaciones')).toBeNull()
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('abre el panel de notificaciones y cierra el menu de usuario', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'profileMenu' }))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.click(screen.getByText('campana'))

    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByTestId('panel-notificaciones')).toBeTruthy()
  })

  it('nunca deja los dos paneles abiertos a la vez', () => {
    renderBar()
    fireEvent.click(screen.getByText('campana'))
    fireEvent.click(screen.getByRole('button', { name: 'profileMenu' }))
    fireEvent.click(screen.getByText('campana'))

    const abiertos = screen.queryAllByTestId('panel-notificaciones').length + screen.queryAllByRole('menu').length
    expect(abiertos).toBe(1)
  })
})
