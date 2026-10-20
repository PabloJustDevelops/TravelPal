'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './landing.module.css'

export default function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sections = Array.from(root.current?.querySelectorAll(':scope > section') ?? [])
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let observer: IntersectionObserver | undefined
    const sync = () => {
      observer?.disconnect()
      sections.forEach(section => section.classList.remove(styles.reveal))
      if (preference.matches || !('IntersectionObserver' in window)) return
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add(styles.reveal)
          observer?.unobserve(entry.target)
        }
      }, { threshold: 0, rootMargin: '0px 0px -24px 0px' })
      // Lo que ya se ve al montar permanece inmediato. El hero queda fuera.
      sections.forEach(section => {
        if (section.getBoundingClientRect().top >= window.innerHeight) observer?.observe(section)
      })
    }
    sync()
    preference.addEventListener('change', sync)
    return () => {
      observer?.disconnect()
      preference.removeEventListener('change', sync)
      sections.forEach(section => section.classList.remove(styles.reveal))
    }
  }, [])

  return <div ref={root}>{children}</div>
}
