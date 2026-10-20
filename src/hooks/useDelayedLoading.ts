'use client'

import { useEffect, useState } from 'react'

export const SKELETON_DELAY_MS = 120

/** Reserva el espacio inmediatamente; solo revela las formas en esperas perceptibles. */
export function useDelayedLoading(pending: boolean, delay = SKELETON_DELAY_MS) {
  const [visible, setVisible] = useState(false)
  if (!pending && visible) setVisible(false)
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [pending, delay])
  return pending && visible
}
