import Link from 'next/link'
import { GlobeAltIcon } from '@heroicons/react/24/outline'

export default function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 rounded-md text-xl font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-on-accent">
        <GlobeAltIcon className="h-6 w-6" aria-hidden="true" />
      </span>
      TravelPal
    </Link>
  )
}
