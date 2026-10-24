'use client'

import Link from 'next/link'
import Brand from './Brand'
import CurrentYear from './CurrentYear'
import styles from './landing.module.css'
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function Footer() {
  const { t, locale } = useI18n()
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-12">
        <div className="grid gap-8 sm:grid-cols-[2fr_1fr_1fr] sm:gap-12">
          <div>
            <Brand />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              {t('footerDescription')}
            </p>
          </div>
          <nav aria-label={t('product')}>
            <h2 className="mb-2 text-sm font-semibold">{t('product')}</h2>
            <ul>
              <li><Link href={localePath(locale, '/signin')} className={styles.footerLink}>{t('signIn')}</Link></li>
              <li><Link href={localePath(locale, '/signup')} className={styles.footerLink}>{t('createAccount')}</Link></li>
            </ul>
          </nav>
          <nav aria-label={t('project')}>
            <h2 className="mb-2 text-sm font-semibold">{t('project')}</h2>
            <ul>
              <li><Link href={localePath(locale, '/aviso-legal')} className={styles.footerLink}>{t('legalNotice')}</Link></li>
              <li><Link href={localePath(locale, '/privacidad')} className={styles.footerLink}>{t('privacy')}</Link></li>
              <li><a href="https://github.com/PabloJustDevelops/TravelPal" className={styles.footerLink}>{t('github')}</a></li>
              <li><a href="https://github.com/PabloJustDevelops/TravelPal/blob/main/LICENSE" className={styles.footerLink}>{t('mit')}</a></li>
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs leading-relaxed text-muted sm:flex-row sm:justify-between">
          <p>© <CurrentYear /> TravelPal. {t('copyright')}</p>
          <p>{t('aiIllustrations')}</p>
        </div>
      </div>
    </footer>
  )
}
