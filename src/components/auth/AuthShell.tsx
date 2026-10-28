'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Brand from '@/components/landing/Brand'
import Link from 'next/link'
import styles from './authStyles.module.css'
import { localePath } from '@/lib/i18n'
import LanguageSelect from '@/components/i18n/LanguageSelect'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function AuthShell({ children, mode }: { children: ReactNode; mode?: 'signup' | 'signin' }) {
  const { t, locale } = useI18n()
  if (mode) {
    const isSignup = mode === 'signup'
    return (
      <div className={styles.shell}>
        <header className={styles.header}>
          <Brand />
          <div className="flex items-center gap-4">
            <LanguageSelect />
            <p className={styles.accountPrompt}>
              {isSignup ? t('alreadyAccount') : t('noAccount')}{' '}
              <Link href={localePath(locale, isSignup ? '/signin' : '/signup')}>{isSignup ? t('startSession') : t('createYourAccount')}</Link>
            </p>
          </div>
        </header>
        <main className={styles.layout}>
          <aside className={styles.story} aria-label={t('authStoryLabel')}>
            <h2>{t('authStoryTitle')}</h2>
            <p>{t('authStoryBody')}</p>
            <Image
              src="/images/atlas/auth-travel-notebook.webp"
              alt={locale === 'en' ? 'Illustration of an open notebook with a Mediterranean coast postcard, coffee, and an olive branch' : 'Ilustración de un cuaderno abierto con una postal de la costa mediterránea, café y una rama de olivo'}
              width={1448}
              height={1086}
              loading="eager"
              sizes="(min-width: 1487px) 800px, (min-width: 1024px) 56vw, 1px"
              className={styles.artwork}
            />
          </aside>
          <section className={styles.formColumn} aria-label={isSignup ? t('register') : t('signInLabel')}>
            {children}
          </section>
        </main>
        <footer className={styles.footer}>
          <p>©{new Date().getFullYear()} TravelPal</p>
          <Link href={localePath(locale, '/')}>{t('backHome')}</Link>
        </footer>
      </div>
    )
  }

  return (
    <main className={styles.recoveryShell}>
      <section className={styles.recoveryContent}>
        <header className={styles.recoveryHeader}>
          <Brand />
          <LanguageSelect />
        </header>
        <div className={styles.recoveryForm}>{children}</div>
        <p className={styles.recoveryFooter}>© {new Date().getFullYear()} TravelPal · {t('tagline')}</p>
      </section>
      <aside className={styles.recoveryArtwork} aria-hidden="true">
        <Image src="/images/atlas/recovery-postcard.webp" alt="" width={1000} height={1400} loading="eager" sizes="(min-width: 1024px) 55vw, 100vw" className={styles.recoveryImage} />
      </aside>
    </main>
  )
}
