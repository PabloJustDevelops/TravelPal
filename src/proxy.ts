import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@insforge/sdk/ssr/middleware'

export async function proxy(req: NextRequest) {
  // Respuesta base donde updateSession escribirá las cookies de sesión.
  const baseRes = NextResponse.next({ request: req })

  const { accessToken } = await updateSession({
    requestCookies: req.cookies,
    responseCookies: baseRes.cookies,
  })

  const hasSession = Boolean(accessToken)

  const protectedRoutes = [
    '/dashboard',
    '/trips',
    '/expenses',
    '/notes',
    '/planning',
    '/alerts',
    '/tasks',
    '/settings',
    '/profile',
  ]
  const authRoutes = [
    '/signin',
    '/signup',
    '/forgot-password',
    '/reset-password'
  ]
  const isProtectedRoute = protectedRoutes.some(route => req.nextUrl.pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  // Si redirigimos, transferimos las cookies que updateSession haya dejado en
  // baseRes (p. ej. el access token recién refrescado).
  const withTransferredCookies = (res: NextResponse) => {
    baseRes.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value)
    })
    return res
  }

  if (!hasSession && isProtectedRoute) {
    const redirectUrl = new URL('/signin', req.url)
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return withTransferredCookies(NextResponse.redirect(redirectUrl))
  }

  if (hasSession && isAuthRoute) {
    const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/dashboard'
    // Asegurar que redirectTo es una ruta relativa válida
    const safePath = redirectTo.startsWith('/') ? redirectTo : '/dashboard'
    return withTransferredCookies(NextResponse.redirect(new URL(safePath, req.url)))
  }

  return baseRes
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
