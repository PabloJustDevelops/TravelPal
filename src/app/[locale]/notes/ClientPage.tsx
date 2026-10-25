'use client'

import {NotesPageContent} from '@/app/notes/page'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function ClientPage() {
  const i18n = useI18n()
  return <NotesPageContent {...i18n} />
}
