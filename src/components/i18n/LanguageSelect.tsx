'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, ChevronDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { locales, type Locale } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

const options: { value: Locale; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
]

function localizedPath(pathname: string, locale: Locale) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'es' || segments[0] === 'en') segments.shift()
  return segments.length ? `/${locale}/${segments.join('/')}` : `/${locale}`
}

export default function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLDivElement | null>>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(options.findIndex(({ value }) => value === locale))
  const selectedIndex = options.findIndex(({ value }) => value === locale)
  const currentLocaleName = options[selectedIndex]?.label ?? options[0].label

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.focus()
  }, [activeIndex, open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const closeAndFocus = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const chooseLocale = (next: Locale) => {
    if (!locales.includes(next)) return
    try {
      localStorage.setItem('travelpal.locale', next)
    } catch {
      // Continue navigation if storage is disabled.
    }
    const target = localizedPath(window.location.pathname, next)
    router.push(`${target}${window.location.search}${window.location.hash}`)
    closeAndFocus()
  }

  const openAt = (index = selectedIndex) => {
    setActiveIndex(index)
    setOpen(true)
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openAt(selectedIndex)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openAt(options.length - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      openAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      openAt(options.length - 1)
    }
  }

  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAndFocus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((activeIndex + delta + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      chooseLocale(options[activeIndex].value)
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${t('selectLanguage')}: ${currentLocaleName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => open ? setOpen(false) : openAt()}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-3 text-sm text-ink hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <GlobeAltIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>{currentLocaleName}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''} ${compact ? 'hidden lg:block' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('selectLanguage')}
          onKeyDown={handleListboxKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-paper shadow-lg"
        >
          {options.map(({ value, label }, index) => {
            const selected = locale === value
            return (
              <div
                key={value}
                ref={(node) => { optionRefs.current[index] = node }}
                role="option"
                aria-selected={selected}
                tabIndex={activeIndex === index ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onClick={() => chooseLocale(value)}
                className={`flex min-h-11 cursor-pointer items-center justify-between px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${index > 0 ? 'border-t border-line' : ''} ${selected ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-surface'}`}
              >
                <span>{label}</span>
                {selected && <CheckIcon className="h-4 w-4" aria-hidden="true" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
