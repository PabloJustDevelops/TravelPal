'use client'

import {TasksPageContent} from '@/app/tasks/page'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function ClientPage() {
  const i18n = useI18n()
  return <TasksPageContent {...i18n} />
}
