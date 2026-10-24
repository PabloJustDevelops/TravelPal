import type { Metadata } from 'next'
import TripsPage from '@/app/trips/page'
import { translate, type Locale } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  return { title: translate(locale, 'tripsTitle'), description: translate(locale, 'tripsMetaDescription') }
}

export default function LocalizedTripsPage() { return <TripsPage /> }
