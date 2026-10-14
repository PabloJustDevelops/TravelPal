"use client";

import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from './Navbar'
import { HomeIcon, MapPinIcon, CurrencyDollarIcon, DocumentTextIcon, CalendarIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Tareas', href: '/tasks', icon: ClipboardDocumentListIcon },
  { name: 'Viajes', href: '/trips', icon: MapPinIcon },
  { name: 'Planificación', href: '/planning', icon: CalendarIcon },
  { name: 'Gastos', href: '/expenses', icon: CurrencyDollarIcon },
  { name: 'Notas', href: '/notes', icon: DocumentTextIcon },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-surface text-ink">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-paper focus:p-3 focus:text-accent">Saltar al contenido</a>
        <Navbar navigation={navigation} />
        <main id="main-content" tabIndex={-1} className="min-w-0 py-8 px-4 sm:px-6 lg:ml-60 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
