'use client'

import {ExpensesPageContent} from '@/app/expenses/page'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function ClientPage() {
  const i18n = useI18n()
  return <ExpensesPageContent {...i18n} />
}
