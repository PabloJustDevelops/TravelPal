'use client'

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { Locale, MessageKey } from './index'
import { translate } from './index'

const LocaleContext = createContext<Locale>('es')

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useI18n() {
  const locale = useContext(LocaleContext)
  return useMemo(() => ({ locale, t: (key: MessageKey) => translate(locale, key) }), [locale])
}
