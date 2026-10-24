'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/lib/auth'
import { localePath, resolveLocale } from '@/lib/i18n'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  const [locale] = useState(() => typeof window === 'undefined'
    ? 'es'
    : resolveLocale(new URLSearchParams(window.location.search).get('locale')))

  useEffect(() => {
    let active = true
    // El cliente browser intercambia insforge_code durante su inicialización,
    // limpia los parámetros de callback y getCurrentUser espera ese intercambio.
    void authService.getCurrentUser().then((user) => {
      if (!active) return
      if (user) router.replace('/dashboard')
      else {
        setFailed(true)
        router.replace(`${localePath(locale, '/signin')}?message=oauth-failed`)
      }
    }).catch(() => {
      if (!active) return
      setFailed(true)
      router.replace(`${localePath(locale, '/signin')}?message=oauth-failed`)
    })
    return () => {
      active = false
    }
  }, [router, locale])

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p role="status">
        {failed ? 'No se pudo completar el acceso con Google.' : 'Completando el acceso con Google…'}
      </p>
    </main>
  )
}
