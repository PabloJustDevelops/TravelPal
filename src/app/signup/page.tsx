import { Suspense } from 'react'
import RegisterForm from '@/components/auth/RegisterForm'
import AuthShell from '@/components/auth/AuthShell'

export default function SignUpPage() {
  return <AuthShell mode="signup"><Suspense fallback={<p role="status">Cargando formulario...</p>}><RegisterForm /></Suspense></AuthShell>
}
