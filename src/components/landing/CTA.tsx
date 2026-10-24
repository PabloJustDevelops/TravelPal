'use client'

import Link from 'next/link'
import { accentLinkClassName } from '@/components/ui/actionStyles'
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function CTA() {
  const { t, locale } = useI18n()
  return (
    <section className="flex flex-col justify-between gap-6 border-t border-line px-5 py-12 sm:flex-row sm:items-center sm:px-12">
      <h2 className="text-3xl font-semibold tracking-tight">{t('ctaTitle')}</h2>
      <Link href={localePath(locale, '/signup')} className={`${accentLinkClassName} min-h-12 shrink-0 self-start px-6 sm:self-auto`}>{t('createAccount')}</Link>
    </section>
  )
}
