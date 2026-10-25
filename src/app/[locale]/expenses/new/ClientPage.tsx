'use client'

import {NewExpensePageContent} from '@/app/expenses/new/page'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function ClientPage() {
  const i18n = useI18n()
  return <NewExpensePageContent {...i18n} />
}
