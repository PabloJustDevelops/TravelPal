'use client'

import {SettingsPageContent} from '@/app/settings/page'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function ClientPage() {
  const i18n = useI18n()
  return <SettingsPageContent {...i18n} />
}
