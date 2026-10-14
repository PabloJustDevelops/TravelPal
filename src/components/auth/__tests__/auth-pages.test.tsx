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
  'ofrece volver a TravelPal y usa la ilustración local en cada flujo',
  (Page) => {
    render(<Page />)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /TravelPal/ })).toHaveAttribute('href', '/')
    const artwork = screen.getByRole('img', { name: /Ilustración.*costa/ })
    expect(artwork.getAttribute('src')).not.toContain('https://')
    expect(screen.getByText(/Tu próximo viaje empieza aquí/)).toBeInTheDocument()
  },
)
