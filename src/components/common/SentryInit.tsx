'use client'

import { initializeSentry } from '@/lib/sentry'

// Before the first React render, including errors in children during hydration.
initializeSentry()

export default function SentryInit() { return null }
