import type { Metadata } from 'next'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import ExampleJourney from '@/components/landing/ExampleJourney'
import Features from '@/components/landing/Features'
import HowItWorks from '@/components/landing/HowItWorks'
import CTA from '@/components/landing/CTA'
import Footer from '@/components/landing/Footer'
import LandingMotion from '@/components/landing/LandingMotion'
import styles from '@/components/landing/landing.module.css'
import type { Locale } from '@/lib/i18n'

const origin = 'https://travelpal.prg-dev.workers.dev'
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const path = `/${locale}`
  const title = locale === 'en' ? 'TravelPal - Your trip, from start to finish' : 'TravelPal - Todos tus planes, un solo viaje'
  const description = locale === 'en' ? 'Organize itineraries, bookings, expenses, and memories in one place.' : 'Organiza itinerarios, reservas, gastos y recuerdos en un solo lugar.'
  return { title, description, robots: { index: true, follow: true }, alternates: { canonical: path, languages: { es: `${origin}/es`, en: `${origin}/en`, 'x-default': `${origin}/es` } }, openGraph: { title, description, locale: locale === 'en' ? 'en_US' : 'es_ES', type: 'website', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: locale === 'en' ? 'TravelPal: your trip, from start to finish' : 'TravelPal: todos tus planes, un solo viaje' }] }, twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] } }
}

export default function LocalizedHome() {
  return <div className={styles.landing}><main className="min-h-screen bg-background text-ink"><Navbar /><Hero /><LandingMotion><ExampleJourney /><Features /><HowItWorks /><CTA /></LandingMotion></main><Footer /></div>
}
