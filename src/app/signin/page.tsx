import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'
import AuthShell from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  robots: { index: true, follow: true },
  alternates: { canonical: '/signin' },
}

export default function SignInPage() {
  return <AuthShell mode="signin"><Suspense fallback={<p role="status">Cargando formulario...</p>}><LoginForm /></Suspense></AuthShell>
}
