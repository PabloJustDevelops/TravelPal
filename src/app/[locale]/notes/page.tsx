import ClientPage from './ClientPage'
import { privateMetadata } from '../metadata'
import { type Locale } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  return privateMetadata(locale, 'navNotes', 'notesMetaDescription')
}

export default function LocalizedPage() { return <ClientPage /> }
