import type { Metadata } from 'next'
import TripPage from '@/app/trip/page'
import { translate, type Locale } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  return { title: translate(locale, 'tripSummary'), description: translate(locale, 'tripMetaDescription') }
}

export default function LocalizedTripPage() { return <TripPage /> }
