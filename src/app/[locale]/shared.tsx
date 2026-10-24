'use client'

import { useI18n } from '@/lib/i18n/LocaleProvider'
import type { MessageKey } from '@/lib/i18n'

export function I18nText({ k }: { k: MessageKey }) { const { t } = useI18n(); return t(k) }
