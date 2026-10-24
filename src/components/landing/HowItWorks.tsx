'use client'

import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function HowItWorks() {
  const { t } = useI18n()
  const steps = [[t('step1'), t('step1Body')], [t('step2'), t('step2Body')], [t('step3'), t('step3Body')]]
  return (
    <section id="how-it-works" className="px-5 py-14 sm:px-12 sm:py-20">
      <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{t('howTitle')}</h2>
      <ol className="mt-10 grid gap-8 sm:grid-cols-3">
        {steps.map(([title, description], index) => (
          <li key={title} className="border-t border-line pt-5">
            <span className="text-sm font-semibold text-accent">{index + 1}</span>
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
