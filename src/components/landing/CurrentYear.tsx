'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>
  const schedule = () => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    timer = setTimeout(() => {
      onChange()
      schedule()
    }, midnight.getTime() - now.getTime())
  }
  schedule()
  window.addEventListener('focus', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    clearTimeout(timer)
    window.removeEventListener('focus', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
}

// El HTML exportado no contiene un año que pueda quedarse obsoleto.
export default function CurrentYear() {
  const year = useSyncExternalStore(subscribe, () => new Date().getFullYear(), () => null)
  return <span className="inline-block min-w-[4ch] tabular-nums">{year}</span>
}
