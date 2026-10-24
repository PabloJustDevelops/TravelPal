'use client'

import Link from 'next/link'
import { localePath } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n/LocaleProvider'

export default function Brand() {
  const { locale } = useI18n()
  return (
    <Link href={localePath(locale, '/')} className="inline-flex min-h-11 w-fit items-center gap-2.5 rounded-md text-xl font-semibold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
      <span
        aria-hidden="true"
        className="h-9 w-9 shrink-0 bg-current"
        style={{
          maskImage: 'url("/brand/travelpal-mark.svg")',
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
          WebkitMaskImage: 'url("/brand/travelpal-mark.svg")',
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
        }}
      />
      TravelPal
    </Link>
  )
}
