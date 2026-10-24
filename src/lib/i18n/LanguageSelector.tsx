'use client'

import { useI18n } from './LocaleProvider'
import { locales } from './index'
import { useRouter } from 'next/navigation'

function localizedPath(pathname: string, locale: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'es' || segments[0] === 'en') segments.shift()
  return segments.length ? `/${locale}/${segments.join('/')}` : `/${locale}`
}

export default function LanguageSelector() {
  const { locale, t } = useI18n()
  const router = useRouter()
  return <div role="region" aria-label={t('selectLanguage')}>
    <label className="fixed right-3 top-16 z-50 rounded bg-paper/95 px-2 py-1 text-xs shadow-sm">
      <span className="sr-only">{t('selectLanguage')}</span>
      <select aria-label={t('selectLanguage')} value={locale} className="min-h-8 bg-transparent" onChange={event => {
        const next = event.target.value
        if (!locales.includes(next as typeof locale)) return
        try { localStorage.setItem('travelpal.locale', next) } catch { /* Continue navigation if storage is disabled. */ }
        const target = localizedPath(window.location.pathname, next)
        router.push(`${target}${window.location.search}${window.location.hash}`)
      }}>
        <option value="es">{t('spanish')}</option>
        <option value="en">{t('english')}</option>
      </select>
    </label>
  </div>
}
