'use client'

import LandingImage from './LandingImage'
import styles from './landing.module.css'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function Features() {
  const { t } = useI18n()
  return (
    <section id="features" className="grid overflow-hidden bg-surface lg:grid-cols-[1.1fr_1fr]">
      <div className="px-5 py-12 sm:px-12 lg:py-16">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('organize')}</h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{t('featuresIntro')}</p>
        <dl className="mt-8 max-w-xl divide-y divide-line">
          <div className="py-5"><dt className="font-semibold">{t('plansTitle')}</dt><dd className="mt-2 text-sm leading-relaxed text-muted">{t('plansBody')}</dd></div>
          <div className="py-5"><dt className="font-semibold">{t('expensesTitle')}</dt><dd className="mt-2 text-sm leading-relaxed text-muted">{t('expensesBody')}</dd></div>
          <div className="py-5"><dt className="font-semibold">{t('memoriesTitle')}</dt><dd className="mt-2 text-sm leading-relaxed text-muted">{t('memoriesBody')}</dd></div>
        </dl>
      </div>
      <LandingImage src="/images/atlas/coastal-journey.webp" alt={t('coastCaption')} width={1536} height={1024} sizes="(min-width: 1024px) 50vw, 100vw" className={styles.featureImage} />
    </section>
  )
}
