import type { Metadata } from 'next'
import { Suspense } from 'react'
import RegisterForm from '@/components/auth/RegisterForm'
import AuthShell from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'Crear cuenta',
  robots: { index: true, follow: true },
  alternates: { canonical: '/signup' },
}

export default function SignUpPage() {
  return <AuthShell mode="signup"><Suspense fallback={<p role="status">Cargando formulario...</p>}><RegisterForm /></Suspense></AuthShell>
}
