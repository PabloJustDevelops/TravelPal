"use client";

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import InteriorSkeleton, { type InteriorScreen } from '@/components/ui/InteriorSkeleton'
import skeletonStyles from '@/components/ui/skeleton.module.css'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from './Navbar'
import styles from './interior.module.css'
import { HomeIcon, MapPinIcon, CurrencyDollarIcon, DocumentTextIcon, CalendarIcon, ClipboardDocumentListIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useI18n } from '@/lib/i18n/LocaleProvider'
import { localePath } from '@/lib/i18n'

interface DashboardLayoutProps {
  children?: React.ReactNode
  pending?: boolean
  skeleton?: InteriorScreen
  loadingView?: string
}

export default function DashboardLayout({ children, pending = false, skeleton = 'dashboard', loadingView }: DashboardLayoutProps) {
  const { locale, t } = useI18n()
  const { loading: authLoading } = useAuth()
  const waiting = authLoading || pending
  const visible = useDelayedLoading(waiting)
  const shell = (
      <div className={`${styles.shell} min-h-screen text-ink`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-paper focus:p-3 focus:text-accent">{t('skipContent')}</a>
        <Navbar navigation={[
          { name: t('navDashboard'), href: locale === 'en' ? localePath(locale, '/dashboard') : '/dashboard', icon: HomeIcon },
          { name: t('navTasks'), href: '/tasks', icon: ClipboardDocumentListIcon },
          { name: t('navTrips'), href: locale === 'en' ? localePath(locale, '/trips') : '/trips', icon: MapPinIcon },
          { name: t('navInspiration'), href: '/travel-inspiration', icon: SparklesIcon },
          { name: t('navPlanning'), href: '/planning', icon: CalendarIcon },
          { name: t('navExpenses'), href: '/expenses', icon: CurrencyDollarIcon },
          { name: t('navNotes'), href: '/notes', icon: DocumentTextIcon },
        ]} />
        <main id="main-content" tabIndex={-1} className={`${styles.main} min-w-0 lg:ml-60`}>
          <div className={skeletonStyles.frame} data-loading-frame={skeleton}>
            {waiting ? <InteriorSkeleton screen={skeleton} view={loadingView} visible={visible} /> : children}
          </div>
        </main>
      </div>
  )
  return <ProtectedRoute redirectTo={locale === 'en' ? localePath(locale, '/signin') : '/signin'} fallback={shell}>{shell}</ProtectedRoute>
}
