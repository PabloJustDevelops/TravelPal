'use client'

import Link from 'next/link'
import LandingImage from './LandingImage'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { accentLinkClassName } from '@/components/ui/actionStyles'
import styles from './landing.module.css'
import { cn } from '@/lib/utils'
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function Hero() {
  const { t, locale } = useI18n()
  return (
    <section aria-labelledby="home-heading" className={styles.hero}>
      <div className={styles.copy}>
        <h1 id="home-heading" className={styles.title}>
          <span>{t('heroOne')}</span>{' '}
          <span>{t('heroTwo')}</span>
        </h1>
        <p className={styles.subtitle}>{t('heroSubtitle')}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link href={localePath(locale, '/signup')} className={cn(accentLinkClassName, 'min-h-14 gap-3 px-6 text-lg')}>
            {t('createTrip')} <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="#example" className="inline-flex min-h-12 items-center gap-3 rounded-sm text-lg font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            {t('seeExample')} <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className={styles.caption} aria-hidden="true">
        <span className={styles.captionTitle}>{t('coast')}</span>
        <p>{t('coastCaption')}</p>
      </div>
      <LandingImage
        src="/images/atlas/coastal-panorama.webp"
        alt={t('heroIllustrationAlt')}
        width={1774}
        height={887}
        preload
        sizes="(max-width: 640px) 200vw, 100vw"
        className={styles.scene}
      />
    </section>
  )
}
