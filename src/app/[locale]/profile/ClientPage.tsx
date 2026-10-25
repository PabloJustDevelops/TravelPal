'use client'

import {ProfilePageContent} from '@/app/profile/page'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function ClientPage() {
  const i18n = useI18n()
  return <ProfilePageContent {...i18n} />
}
