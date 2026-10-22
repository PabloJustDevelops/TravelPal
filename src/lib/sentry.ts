import { captureException, init, type ErrorEvent, type Event, type EventHint } from '@sentry/browser'

let initialized = false
let anonymousId: string | undefined
const captured = new WeakMap<object, string>()
const SENTRY_INGEST_HOST = 'o4511064837062656.ingest.de.sentry.io'

export function sampleRate(value: string | undefined): number {
  const rate = value === undefined || value === '' ? 0.01 : Number(value)
  return Number.isFinite(rate) && rate >= 0 && rate <= 0.05 ? rate : 0.01
}

const MESSAGE_LIMIT = 200

// The exception message is the only free text we keep: it is what makes an
// issue readable (title and grouping). It is scrubbed of identifiers and
// truncated before leaving the browser.
export function scrubMessage(value: string | undefined): string | undefined {
  if (!value) return undefined
  const scrubbed = value
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\bBearer\s+\S+/gi, '[token]')
    .replace(/\b(sk|pk|rk)_[A-Za-z0-9_]{8,}/g, '[token]')
    .replace(/\bsntry[a-z]?_[A-Za-z0-9_]{8,}/g, '[token]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[token]')
    .replace(/\b\d{9,}\b/g, '[num]')
    .replace(/\s+/g, ' ')
    .trim()
  if (!scrubbed) return undefined
  return scrubbed.length > MESSAGE_LIMIT ? `${scrubbed.slice(0, MESSAGE_LIMIT - 1)}…` : scrubbed
}

function cleanUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, 'https://travelpal.invalid')
    if (!['https:', 'http:'].includes(url.protocol)) return undefined
    return `${url.origin}${url.pathname}`
  } catch { return undefined }
}

// Allowlist: no arbitrary messages, breadcrumbs, headers, bodies or app context.
// Keep stack locations for source maps, but never locals or exception messages.
export function sanitizeEvent<T extends Event>(event: T): T {
  return {
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
    user: anonymousId ? { id: anonymousId } : undefined,
    request: { url: cleanUrl(event.request?.url ?? (typeof window !== 'undefined' ? window.location.href : undefined)) },
    exception: event.exception ? { values: event.exception.values?.map((exception) => ({
      type: exception.type,
      value: scrubMessage(exception.value) ?? 'Exception details omitted',
      mechanism: exception.mechanism ? { type: exception.mechanism.type, handled: exception.mechanism.handled } : undefined,
      stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.map((frame) => ({
        filename: cleanUrl(frame.filename),
        function: frame.function,
        lineno: frame.lineno,
        colno: frame.colno,
        in_app: frame.in_app,
      })) } : undefined,
    })) } : undefined,
  } as T
}

export function initializeSentry(): boolean {
  if (initialized) return true
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (typeof window === 'undefined' || !dsn) return false
  try {
    const parsed = new URL(dsn)
    if (parsed.port || parsed.password || parsed.search || parsed.hash || parsed.protocol !== 'https:' || parsed.hostname !== SENTRY_INGEST_HOST || !parsed.username || !/^\/\d+$/.test(parsed.pathname)) return false
    anonymousId = `anon-${crypto.randomUUID()}`
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
      sendDefaultPii: false,
      tracesSampleRate: sampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
      // Own handlers share a WeakMap with React. No automatic breadcrumbs,
      // sessions, tracing, replay, request headers or console collection.
      defaultIntegrations: false,
      beforeSend: (event: ErrorEvent) => sanitizeEvent(event),
      beforeSendTransaction: () => null,
    })
    initialized = true
    window.addEventListener('error', (event) => {
      captureClientException(event.error ?? new Error('Unhandled browser error'), { mechanism: { type: 'onerror', handled: false } })
    })
    window.addEventListener('unhandledrejection', (event) => {
      captureClientException(event.reason, { mechanism: { type: 'onunhandledrejection', handled: false } })
    })
    return true
  } catch { return false }
}

export function captureClientException(error: unknown, hint?: EventHint): string | undefined {
  if (!initializeSentry()) return undefined
  const object = (typeof error === 'object' && error !== null) || typeof error === 'function' ? error as object : undefined
  if (object && captured.has(object)) return captured.get(object)
  try {
    const id = hint ? captureException(error, hint) : captureException(error)
    if (object) captured.set(object, id)
    return id
  } catch { return undefined }
}
