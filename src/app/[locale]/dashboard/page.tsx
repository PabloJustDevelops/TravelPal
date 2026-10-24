import type { Metadata } from 'next'
import DashboardPage from '@/app/dashboard/page'
import { translate, type Locale } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  return { title: translate(locale, 'navDashboard'), description: translate(locale, 'dashboardMetaDescription') }
}

export default function LocalizedDashboardPage() { return <DashboardPage /> }
