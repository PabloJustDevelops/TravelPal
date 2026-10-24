import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n'

const origin = 'https://travelpal.prg-dev.workers.dev'
const routeTitles = { signin: ['Iniciar sesión', 'Sign in'], signup: ['Crear cuenta', 'Create account'], 'forgot-password': ['Recuperar contraseña', 'Reset your password'], 'reset-password': ['Restablecer contraseña', 'Choose a new password'] } as const
const descriptions = {
  signin: ['Accede a tu cuenta de TravelPal.', 'Sign in to your TravelPal account.'],
  signup: ['Crea una cuenta y organiza tu próximo viaje.', 'Create an account and plan your next trip.'],
  'forgot-password': ['Recupera el acceso a tu cuenta de TravelPal.', 'Recover access to your TravelPal account.'],
  'reset-password': ['Elige una nueva contraseña para tu cuenta.', 'Choose a new password for your account.'],
} as const

export function authMetadata(route: keyof typeof routeTitles) {
  return async ({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> => {
    const { locale } = await params
    const path = `/${locale}/${route}`
    const languageIndex = locale === 'en' ? 1 : 0
    const title = routeTitles[route][languageIndex]
    const description = descriptions[route][languageIndex]
    return { title, description, robots: { index: true, follow: true }, alternates: { canonical: path, languages: { es: `${origin}/es/${route}`, en: `${origin}/en/${route}`, 'x-default': `${origin}/es/${route}` } }, openGraph: { title, description, locale: locale === 'en' ? 'en_US' : 'es_ES', type: 'website', images: [{ url: '/og-image.png', width: 1200, height: 630 }] }, twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] } }
  }
}

export const generateMetadata = authMetadata('signup')
