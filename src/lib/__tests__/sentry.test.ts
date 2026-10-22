import { randomUUID } from 'node:crypto'
import * as SDK from '@sentry/browser'
import { initializeSentry, captureClientException, sanitizeEvent, sampleRate } from '@/lib/sentry'

jest.mock('@sentry/browser', () => ({ init: jest.fn(), captureException: jest.fn(() => 'event-123') }))

beforeAll(() => { Object.defineProperty(crypto, 'randomUUID', { value: randomUUID, configurable: true }) })

beforeEach(() => { jest.clearAllMocks(); delete process.env.NEXT_PUBLIC_SENTRY_DSN })

it('does not initialize or capture without a DSN', () => {
  expect(initializeSentry()).toBe(false)
  expect(captureClientException(new Error('private'))).toBeUndefined()
  expect(SDK.init).not.toHaveBeenCalled()
  expect(SDK.captureException).not.toHaveBeenCalled()
})

it('rejects invalid or non-CSP ingest DSNs without initializing', () => {
  for (const dsn of ['invalid', 'https://key@evil.test/1', 'https://key@o4511064837062656.ingest.sentry.io/4512299836047440', 'https://key@o4511064837062656.ingest.de.sentry.io.evil.test/4512299836047440', 'http://key@o4511064837062656.ingest.de.sentry.io/4512299836047440', 'https://key@o4511064837062656.ingest.de.sentry.io:9999/4512299836047440', 'https://key@o4511064837062656.ingest.de.sentry.io/4512299836047440?token=secret']) {
    process.env.NEXT_PUBLIC_SENTRY_DSN = dsn
    expect(initializeSentry()).toBe(false)
  }
  expect(SDK.init).not.toHaveBeenCalled()
})

it('initializes once, marks global errors unhandled and deduplicates React, error and rejection captures', () => {
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://bb04fbea9212639a4cb2ab52d3a39540@o4511064837062656.ingest.de.sentry.io/4512299836047440'
  expect(initializeSentry()).toBe(true)
  expect(initializeSentry()).toBe(true)
  expect(SDK.init).toHaveBeenCalledTimes(1)
  expect(SDK.init).toHaveBeenCalledWith(expect.objectContaining({ sendDefaultPii: false, environment: 'production', defaultIntegrations: false }))
  const error = new Error('broken')
  expect(captureClientException(error)).toBe('event-123')
  window.dispatchEvent(new ErrorEvent('error', { error }))
  const rejection = new Event('unhandledrejection')
  Object.defineProperty(rejection, 'reason', { value: error })
  window.dispatchEvent(rejection)
  expect(SDK.captureException).toHaveBeenCalledTimes(1)
  expect(SDK.captureException).toHaveBeenNthCalledWith(1, error)

  const globalError = new Error('global error')
  window.dispatchEvent(new ErrorEvent('error', { error: globalError }))
  expect(SDK.captureException).toHaveBeenNthCalledWith(2, globalError, { mechanism: { type: 'onerror', handled: false } })

  const rejectionError = new Error('global rejection')
  const globalRejection = new Event('unhandledrejection')
  Object.defineProperty(globalRejection, 'reason', { value: rejectionError })
  window.dispatchEvent(globalRejection)
  expect(SDK.captureException).toHaveBeenNthCalledWith(3, rejectionError, { mechanism: { type: 'onunhandledrejection', handled: false } })
  window.dispatchEvent(new ErrorEvent('error', { error: globalError }))
  expect(SDK.captureException).toHaveBeenCalledTimes(3)
})

it('drops private payloads, query/hash, auth headers and authenticated users', () => {
  const event = sanitizeEvent({
    event_id: 'abc', message: 'email@example.com',
    user: { id: 'authenticated-id', email: 'email@example.com' },
    request: { url: 'https://travelpal.test/trip?redirectTo=secret#token', headers: { Authorization: 'Bearer secret' }, data: 'trip' },
    extra: { trip: 'private' }, contexts: { trip: { name: 'private' } },
    breadcrumbs: [{ message: 'private' }],
    exception: { values: [{ type: 'Error', value: 'email@example.com', stacktrace: { frames: [{ filename: 'https://travelpal.test/app.js?token=secret', lineno: 1, vars: { token: 'secret' } }] } }] },
  })
  expect(event.request).toEqual({ url: 'https://travelpal.test/trip' })
  expect(event.user?.id).not.toBe('authenticated-id')
  const serialized = JSON.stringify(event)
  for (const sensitive of ['secret', 'email@example.com', 'authenticated-id', 'Authorization', 'redirectTo', 'private']) expect(serialized).not.toContain(sensitive)
  expect(event.exception?.values?.[0].stacktrace?.frames?.[0].lineno).toBe(1)
})

it('bounds configurable trace sampling to a low rate', () => {
  expect(sampleRate(undefined)).toBe(0.01)
  expect(sampleRate('0')).toBe(0)
  expect(sampleRate('0.02')).toBe(0.02)
  for (const value of ['NaN', '-1', '1', 'Infinity']) expect(sampleRate(value)).toBe(0.01)
})
