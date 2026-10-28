'use client'

import { useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Brand from '@/components/landing/Brand'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
import type { Locale } from '@/lib/i18n'
import styles from './notFound.module.css'

const subscribe = () => () => {}
const browserLocale = (): Locale => /^\/en(?:\/|$)/.test(window.location.pathname) ? 'en' : 'es'
const serverLocale = (): Locale => 'es'

export default function NotFoundPage() {
  const locale = useSyncExternalStore(subscribe, browserLocale, serverLocale)
  const english = locale === 'en'
  return (
    <LocaleProvider locale={locale}>
      <main className={styles.page}>
        <header className={styles.header}><Brand /></header>
        <div className={styles.layout}>
          <div className={styles.artwork}>
            <Image src="/images/atlas/not-found-map.webp" alt="" width={1200} height={900} loading="eager" className={styles.image} />
          </div>
          <div className={styles.content}>
            <p className={styles.code}>404</p>
            <h1>{english ? 'It looks like the road ends here.' : 'Parece que aquí termina el camino.'}</h1>
            <p className={styles.description}>{english ? 'We couldn’t find the page you’re looking for. The link may have changed, moved or no longer exist.' : 'No encontramos la página que buscas. Puede que el enlace haya cambiado, se haya movido o ya no exista.'}</p>
            <Link href={`/${locale}`} className={styles.action}>{english ? 'Back to home' : 'Volver al inicio'}</Link>
          </div>
        </div>
      </main>
    </LocaleProvider>
  )
}
