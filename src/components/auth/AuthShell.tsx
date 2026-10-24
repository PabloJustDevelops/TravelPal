'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Brand from '@/components/landing/Brand'
import Link from 'next/link'
import styles from './authStyles.module.css'
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function AuthShell({ children, mode }: { children: ReactNode; mode?: 'signup' | 'signin' }) {
  const { t, locale } = useI18n()
  if (mode) {
    const isSignup = mode === 'signup'
    return (
      <div className={styles.shell}>
        <header className={styles.header}>
          <Brand />
          <p className={styles.accountPrompt}>
            {isSignup ? t('alreadyAccount') : t('noAccount')}{' '}
            <Link href={localePath(locale, isSignup ? '/signin' : '/signup')}>{isSignup ? t('startSession') : t('createYourAccount')}</Link>
          </p>
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
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-2">
        <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-16 lg:py-10">
          <Brand />
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 lg:py-12">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t('travelSpace')}</p>
            {children}
          </div>
          <p className="text-xs text-muted">© {new Date().getFullYear()} TravelPal · {t('tagline')}</p>
        </section>
        <aside className="m-5 mt-0 overflow-hidden rounded-3xl bg-surface lg:m-5 lg:ml-0 lg:flex lg:flex-col lg:justify-center">
          <div className="px-6 pt-8 sm:px-10 lg:pt-12">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t('fewerTabs')}</p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{t('nextTrip')}</h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted">{t('tripDescription')}</p>
          </div>
          <Image
            src="/images/atlas/coastal-journey.webp"
            alt={locale === 'en' ? 'Illustration of a traveler walking through a town on the Mediterranean coast' : 'Ilustración de un viajero recorriendo un pueblo junto a la costa mediterránea'}
            width={1536}
            height={1024}
            sizes="(min-width: 1024px) 50vw, 100vw"
            loading="eager"
            className="mt-8 h-auto w-full"
          />
          <p className="px-6 py-4 text-xs text-muted sm:px-10">{t('authIllustration')}</p>
        </aside>
      </div>
    </main>
  )
}
