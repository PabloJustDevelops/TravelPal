'use client'

import { EditExpenseContent } from '@/app/expense-edit/page'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useI18n } from '@/lib/i18n/LocaleProvider'
import { Suspense } from 'react'

export default function ClientPage() {
  const i18n = useI18n()
  return <Suspense fallback={<DashboardLayout skeleton="expense-edit" pending />}><EditExpenseContent {...i18n} /></Suspense>
}
