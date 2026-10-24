import type { Metadata } from 'next'
import { Suspense } from 'react'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'
import AuthShell from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'Restablecer contraseña',
  robots: { index: false, follow: true },
  alternates: { canonical: '/es/reset-password/' },
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold tracking-tight">Restablecer contraseña</h1>
      <p className="mt-3 leading-relaxed text-muted">Elige una nueva contraseña para recuperar el acceso a tus viajes.</p>
      <Suspense fallback={<p role="status">Cargando formulario...</p>}><ResetPasswordForm /></Suspense>
    </AuthShell>
  )
}
