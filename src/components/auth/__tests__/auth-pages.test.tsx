import { render, screen } from '@testing-library/react'
import SignInPage from '@/app/signin/page'
import SignUpPage from '@/app/signup/page'
import ForgotPasswordPage from '@/app/forgot-password/page'
import ResetPasswordPage from '@/app/reset-password/page'

jest.mock('../LoginForm', () => ({ __esModule: true, default: () => <h1>Acceso</h1> }))
jest.mock('../RegisterForm', () => ({ __esModule: true, default: () => <h1>Registro</h1> }))
jest.mock('../ForgotPasswordForm', () => ({ __esModule: true, default: () => <form aria-label="Recuperación" /> }))
jest.mock('../ResetPasswordForm', () => ({ __esModule: true, default: () => <form aria-label="Nueva contraseña" /> }))

it.each([SignInPage, SignUpPage, ForgotPasswordPage, ResetPasswordPage])(
  'ofrece volver a TravelPal en cada flujo',
  (Page) => {
    render(<Page />)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /TravelPal/ })).toHaveAttribute('href', '/')
  },
)

it.each([SignInPage, SignUpPage])('usa la mesa de viaje en acceso y registro', Page => {
  render(<Page />)
  expect(screen.getByText(/El viaje empieza mucho antes de salir/)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /cuaderno/ })).toHaveAttribute('src', expect.stringContaining('auth-travel-notebook'))
  expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
})

it.each([ForgotPasswordPage, ResetPasswordPage])('mantiene la composición de recuperación', Page => {
  render(<Page />)
  expect(screen.getByText(/Tu próximo viaje empieza aquí/)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Ilustración.*costa/ }).getAttribute('src')).not.toContain('https://')
})
