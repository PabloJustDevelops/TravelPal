'use client'

import { useEffect } from 'react'
import { resolvePreferredLocale } from './index'

export default function LocaleBootstrap() {
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem('travelpal.locale') } catch { /* Browser storage may be disabled. */ }
    const locale = resolvePreferredLocale(saved, navigator.language)
    const query = window.location.search
    window.location.replace(`/` + locale + query + window.location.hash)
  }, [])
  return null
}
