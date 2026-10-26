'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/lib/i18n/LocaleProvider'
import { localePath } from '@/lib/i18n'
import { avatarUrlSchema } from '@/lib/avatar-url'
import NotificationSystem from '@/components/notifications/NotificationSystem'
import LanguageSelect from '@/components/i18n/LanguageSelect'
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronDownIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface TopBarProps {
  mobileMenuOpen: boolean
  onMobileMenuToggle: () => void
  mobileToggleRef: RefObject<HTMLButtonElement | null>
}

export default function TopBar({ mobileMenuOpen, onMobileMenuToggle, mobileToggleRef }: TopBarProps) {
  const { user, signOut } = useAuth()
  const { locale, t } = useI18n()
  const profileRootRef = useRef<HTMLDivElement>(null)
  const profileToggleRef = useRef<HTMLButtonElement>(null)
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null)
  const profileMenuOpen = openMenu === 'profile'
  const [avatarError, setAvatarError] = useState(false)
  const avatar = avatarUrlSchema.safeParse(user?.avatar_url ?? '')
  const avatarUrl = avatar.success ? avatar.data : undefined
  const displayName = user?.full_name || t('user')

  // El menu de usuario se cierra al pulsar fuera; la campana gestiona su propio cierre y avisa
  // por onOpenChange, asi que aqui solo se coordina el estado (uno abierto como maximo).
  useEffect(() => {
    if (openMenu !== 'profile') return
    const handlePointerDown = (event: PointerEvent) => {
      if (!profileRootRef.current?.contains(event.target as Node)) setOpenMenu(openMenu === 'profile' ? null : openMenu)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openMenu])

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      window.location.href = locale === 'en' ? localePath(locale, '/signin') : '/signin'
    }
  }

  return (
    <div className="sticky top-0 z-30 flex h-16 items-center justify-end gap-2 border-b border-line bg-paper/85 px-4 backdrop-blur sm:px-6 lg:ml-60">
      <button
        ref={mobileToggleRef}
        type="button"
        onClick={onMobileMenuToggle}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-ink transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        aria-label={mobileMenuOpen ? t('closeMobileMenu') : t('openMobileMenu')}
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-menu"
      >
        {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" aria-hidden="true" /> : <Bars3Icon className="h-6 w-6" aria-hidden="true" />}
      </button>
      <LanguageSelect compact />
      <NotificationSystem
        className="shrink-0"
        panelPlacement="bottom-end"
        open={openMenu === 'notifications'}
        onOpenChange={(next) => setOpenMenu(next ? 'notifications' : null)}
      />
      <div
        ref={profileRootRef}
        className="relative"
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !profileMenuOpen) return
          setOpenMenu(null)
          profileToggleRef.current?.focus()
        }}
      >
        <button
          ref={profileToggleRef}
          id="user-menu-button"
          type="button"
          onClick={() => setOpenMenu((current) => (current === 'profile' ? null : 'profile'))}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-ink transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={t('profileMenu')}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
        >
          {avatarUrl && !avatarError ? (
            <img src={avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" onError={() => setAvatarError(true)} />
          ) : (
            <UserCircleIcon className="h-8 w-8 text-muted" aria-hidden="true" />
          )}
          <span className="hidden max-w-40 truncate text-left text-sm font-medium sm:inline">{displayName}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </button>
        {profileMenuOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-52 origin-top-right divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper shadow-lg"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="user-menu-button"
          >
            <div className="px-4 py-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t('connectedAs')}</p>
              <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
            <div className="py-1">
              <Link href="/profile" className="flex min-h-11 items-center px-4 py-2.5 text-sm text-ink transition-colors hover:bg-surface" onClick={() => setOpenMenu(null)} role="menuitem">
                <UserCircleIcon className="mr-3 h-5 w-5 text-muted" aria-hidden="true" />{t('myProfile')}
              </Link>
              <Link href="/settings" className="flex min-h-11 items-center px-4 py-2.5 text-sm text-ink transition-colors hover:bg-surface" onClick={() => setOpenMenu(null)} role="menuitem">
                <Cog6ToothIcon className="mr-3 h-5 w-5 text-muted" aria-hidden="true" />{t('settings')}
              </Link>
            </div>
            <div className="py-1">
              <button onClick={handleSignOut} className="flex min-h-11 w-full items-center px-4 py-2.5 text-sm text-danger transition-colors hover:bg-surface" role="menuitem">
                <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5" aria-hidden="true" />{t('signOut')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
