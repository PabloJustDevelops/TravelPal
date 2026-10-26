import { fireEvent, render, screen } from '@testing-library/react'
import { NotificationSystem } from '../NotificationSystem'

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ locale: 'es', t: (key: string) => key }),
}))

describe('NotificationSystem en modo controlado', () => {
  it('pinta el panel cuando open es true', () => {
    render(<NotificationSystem open onOpenChange={jest.fn()} />)
    expect(screen.getByRole('region', { name: 'notifications' })).toBeTruthy()
  })

  it('no pinta el panel cuando open es false', () => {
    render(<NotificationSystem open={false} onOpenChange={jest.fn()} />)
    expect(screen.queryByRole('region', { name: 'notifications' })).toBeNull()
  })

  it('avisa al cerrar con Escape', () => {
    const onOpenChange = jest.fn()
    render(<NotificationSystem open onOpenChange={onOpenChange} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('avisa al pulsar fuera del panel', () => {
    const onOpenChange = jest.fn()
    render(<NotificationSystem open onOpenChange={onOpenChange} />)

    fireEvent.pointerDown(document.body)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
