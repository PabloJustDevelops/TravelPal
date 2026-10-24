import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { locales, type Locale } from '@/lib/i18n'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
import LanguageSelector from '@/lib/i18n/LanguageSelector'

export function generateStaticParams() {
  return locales.map(locale => ({ locale }))
}
export const dynamicParams = false

export default async function PublicLocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  return <LocaleProvider locale={locale as Locale}><LanguageSelector />{children}</LocaleProvider>
}
