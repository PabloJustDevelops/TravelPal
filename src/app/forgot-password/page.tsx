import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'
import AuthShell from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  robots: { index: false, follow: true },
  alternates: { canonical: '/es/forgot-password/' },
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold tracking-tight">Recuperar contraseña</h1>
      <p className="mt-3 leading-relaxed text-muted">Te enviaremos un enlace para que vuelvas a tus planes.</p>
      <Suspense fallback={<p role="status">Cargando formulario...</p>}><ForgotPasswordForm /></Suspense>
      <Link href="/signin" className="mt-6 text-sm font-medium text-accent hover:text-accent-hover">Volver al inicio de sesión</Link>
    </AuthShell>
  )
}
