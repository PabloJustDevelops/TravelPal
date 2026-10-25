'use client'

import { useState, type RefObject } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { usePathname } from 'next/navigation'
import { UserCircleIcon } from '@heroicons/react/24/outline'
import { avatarUrlSchema } from '@/lib/avatar-url'
import { useI18n } from '@/lib/i18n/LocaleProvider'
import { localePath, stripLocale } from '@/lib/i18n'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavbarProps {
  navigation: NavigationItem[]
  mobileMenuOpen: boolean
  onMobileMenuOpenChange: (open: boolean) => void
  mobileToggleRef: RefObject<HTMLButtonElement | null>
}

export default function Navbar({ navigation, mobileMenuOpen, onMobileMenuOpenChange, mobileToggleRef }: NavbarProps) {
  const [avatarError, setAvatarError] = useState(false)
  const { user, signOut } = useAuth()
  const { locale, t } = useI18n()
  const avatar = avatarUrlSchema.safeParse(user?.avatar_url ?? '')
  const avatarUrl = avatar.success ? avatar.data : undefined
  const pathname = usePathname()
  const currentPath = stripLocale(pathname)

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      window.location.href = locale === 'en' ? localePath(locale, '/signin') : '/signin'
    }
  }

  return (
    <nav
      aria-label={t('mainNavigation')}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !mobileMenuOpen) return
        onMobileMenuOpenChange(false)
        mobileToggleRef.current?.focus()
      }}
      className={`relative z-20 bg-paper lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-60 lg:border-r lg:border-line ${mobileMenuOpen ? 'z-[100]' : ''}`}
    >
      <div className="px-4 sm:px-6 lg:h-full lg:px-4">
        <div className="flex h-16 items-center justify-between gap-4 lg:h-full lg:flex-col lg:items-stretch lg:justify-start lg:py-6">
          <div className="flex flex-shrink-0 items-center">
            <Link
              href={locale === 'en' ? localePath(locale, '/dashboard') : '/dashboard'}
              className="inline-flex min-h-11 items-center gap-3 rounded-md font-sans text-2xl font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span
                aria-hidden="true"
                className="h-10 w-10 shrink-0 bg-current"
                style={{
                  maskImage: 'url("/brand/travelpal-mark.svg")',
                  maskPosition: 'center',
                  maskRepeat: 'no-repeat',
                  maskSize: 'contain',
                  WebkitMaskImage: 'url("/brand/travelpal-mark.svg")',
                  WebkitMaskPosition: 'center',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskSize: 'contain',
                }}
              />
              TravelPal
            </Link>
          </div>

          <div className="hidden flex-1 items-start pt-10 lg:flex">
            <div className="flex w-full flex-col gap-2">
              {navigation.map((item) => {
                const isActive = currentPath === item.href || currentPath?.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex min-h-12 items-center gap-3 rounded-lg border-l-4 border-transparent px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${isActive ? 'border-l-accent bg-accent-soft text-accent' : 'text-muted hover:bg-surface hover:text-ink'}`}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />{item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-menu" className="border-t border-line bg-paper lg:hidden">
          <div className="space-y-1 pb-3 pt-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                aria-current={currentPath === item.href || currentPath?.startsWith(item.href + '/') ? 'page' : undefined}
                className="flex min-h-12 items-center px-4 py-3 text-base font-medium text-muted hover:bg-surface hover:text-ink aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
                onClick={() => onMobileMenuOpenChange(false)}
              >
                <item.icon className="mr-3 h-5 w-5" aria-hidden="true" />{item.name}
              </Link>
            ))}
          </div>
          <div className="border-t border-line pb-3 pt-4">
            <div className="flex items-center px-4">
              {avatarUrl && !avatarError ? (
                <img src={avatarUrl} alt={user?.full_name || t('user')} className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" onError={() => setAvatarError(true)} />
              ) : (
                <UserCircleIcon className="h-10 w-10 text-muted" />
              )}
              <div className="ml-3 min-w-0">
                <div className="truncate text-base font-medium text-ink">{user?.full_name || t('user')}</div>
                <div className="truncate text-sm text-muted">{user?.email}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Link href="/profile" className="block min-h-12 px-4 py-3 text-base font-medium text-muted hover:bg-surface hover:text-ink" onClick={() => onMobileMenuOpenChange(false)}>{t('myProfile')}</Link>
              <Link href="/settings" className="block min-h-12 px-4 py-3 text-base font-medium text-muted hover:bg-surface hover:text-ink" onClick={() => onMobileMenuOpenChange(false)}>{t('settings')}</Link>
              <button onClick={handleSignOut} className="block min-h-12 w-full px-4 py-3 text-left text-base font-medium text-muted hover:bg-surface hover:text-ink">{t('signOut')}</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
