import type { ReactNode } from 'react';
import Link from 'next/link';
import Brand from '@/components/landing/Brand';
import Footer from '@/components/landing/Footer';
import PageTitle from '@/components/ui/PageTitle';
import LanguageSelect from '@/components/i18n/LanguageSelect';
import { legalPending } from '@/lib/legal';
import type { Locale } from '@/lib/i18n'
import { formatDate, translate } from '@/lib/i18n'
import { localePath } from '@/lib/i18n'

export default function LegalPage({ title, children, locale = 'es', translated = false }: { title: string; children: ReactNode; locale?: Locale; translated?: boolean }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key)
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 sm:px-12">
        <Brand />
        <div className="flex items-center gap-4">
          <LanguageSelect />
          <Link href={localePath(locale, '/')} className="inline-flex min-h-11 items-center text-accent underline">{t('legalBack')}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-12 sm:px-12">
        <PageTitle title={title} subtitle={`${t('updated')}: ${formatDate(new Date('2026-10-23T12:00:00Z'), locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`} />
        {translated && <p role="note" className="rounded border border-line p-4">{t('translationNotice')}</p>}
        {legalPending && (
          <div role="alert" className="rounded-lg border border-warning bg-surface p-5 text-ink">
            <p className="font-semibold">{t('legalPendingTitle')}</p>
            <p className="mt-2">{t('legalPendingBody')}</p>
          </div>
        )}
        <div className="space-y-8 text-base leading-relaxed [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p+p]:mt-3 [&_a]:text-accent [&_a]:underline [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
        <nav aria-label={t('legalNav')} className="flex flex-wrap gap-6 border-t border-line pt-6">
          <Link href={localePath(locale, '/aviso-legal')} className="inline-flex min-h-11 items-center text-accent underline">{t('legalNotice')}</Link>
          <Link href={localePath(locale, '/privacidad')} className="inline-flex min-h-11 items-center text-accent underline">{t('privacy')}</Link>
        </nav>
      </main>
      <Footer />
    </div>
  );
}
