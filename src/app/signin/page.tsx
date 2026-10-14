import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'
import AuthShell from '@/components/auth/AuthShell'

export default function SignInPage() {
  return <AuthShell><Suspense fallback={<p role="status">Cargando formulario...</p>}><LoginForm /></Suspense></AuthShell>
}
