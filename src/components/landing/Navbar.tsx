'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import Brand from './Brand'
import { accentLinkClassName } from '@/components/ui/actionStyles'
import { localePath } from '@/lib/i18n'
import LanguageSelect from '@/components/i18n/LanguageSelect'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { t, locale } = useI18n()
  const links = [{ name: t('navFeatures'), href: '#features' }, { name: t('navHow'), href: '#how-it-works' }]
  return (
    <header className="relative z-20 bg-paper">
      <nav aria-label={t('home')} className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-5 py-5 sm:px-12">
        <Brand />
        <div className="hidden items-center gap-8 lg:flex">{links.map(link => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-muted hover:text-accent">{link.name}</Link>)}</div>
        <div className="hidden items-center gap-6 lg:flex"><LanguageSelect /><Link href={localePath(locale, '/signin')} className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-accent hover:text-accent-hover">{t('enter')}</Link></div>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="landing-menu" aria-label={open ? t('closeMenu') : t('openMenu')} className="flex h-12 w-12 items-center justify-center rounded-lg border border-line lg:hidden">{open ? <XMarkIcon className="h-6 w-6" aria-hidden="true" /> : <Bars3Icon className="h-6 w-6" aria-hidden="true" />}</button>
      </nav>
      {open && <nav id="landing-menu" aria-label={t('mobileMenu')} className="border-t border-line px-5 pb-5 lg:hidden">{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center font-medium">{link.name}</Link>)}<div className="pt-2"><LanguageSelect /></div><Link href={localePath(locale, '/signin')} className="flex min-h-12 items-center font-medium">{t('enter')}</Link><Link href={localePath(locale, '/signup')} className={`${accentLinkClassName} mt-2 w-full min-h-12`}>{t('createAccount')}</Link></nav>}
    </header>
  )
}
