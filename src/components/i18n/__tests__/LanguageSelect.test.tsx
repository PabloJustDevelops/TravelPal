import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LanguageSelect from '../LanguageSelect'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: () => ({ locale: 'es', t: (key: string) => ({ selectLanguage: 'Seleccionar idioma' })[key] ?? key }),
}))

beforeEach(() => {
  mockPush.mockReset()
  localStorage.clear()
  window.history.replaceState({}, '', '/dashboard?tab=trips#upcoming')
})

it('abre con teclado, navega las opciones y Escape devuelve el foco al botón', async () => {
  const user = userEvent.setup()
  render(<LanguageSelect />)

  const trigger = screen.getByRole('button', { name: /español/i })
  trigger.focus()
  await user.keyboard('{ArrowDown}')

  expect(screen.getByRole('listbox')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Español' })).toHaveAttribute('aria-selected', 'true')
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('option', { name: 'English' })).toHaveFocus()
  await user.keyboard('{Escape}')

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('cambia a English, conserva query y hash, y persiste el idioma', async () => {
  const user = userEvent.setup()
  render(<LanguageSelect />)

  fireEvent.click(screen.getByRole('button', { name: /español/i }))
  await user.click(screen.getByRole('option', { name: 'English' }))

  expect(localStorage.getItem('travelpal.locale')).toBe('en')
  expect(mockPush).toHaveBeenCalledWith('/en/dashboard?tab=trips#upcoming')
})

it('cierra al hacer clic fuera', async () => {
  const user = userEvent.setup()
  render(<>
    <LanguageSelect />
    <button type="button">Fuera</button>
  </>)

  await user.click(screen.getByRole('button', { name: /español/i }))
  await user.click(screen.getByRole('button', { name: 'Fuera' }))

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})
