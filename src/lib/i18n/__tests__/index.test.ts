import { dictionaries, formatDate, formatNumber, locales, resolveLocale, resolvePreferredLocale } from '..'

describe('locale helpers', () => {
  it('resolves supported locale tags and falls back to Spanish', () => {
    expect(resolveLocale('en-GB')).toBe('en')
    expect(resolveLocale('ES_es')).toBe('es')
    expect(resolveLocale('fr-FR')).toBe('es')
    expect(resolveLocale(null)).toBe('es')
  })

  it('prefers a saved supported locale, then the browser locale, then Spanish', () => {
    expect(resolvePreferredLocale('es', 'en-US')).toBe('es')
    expect(resolvePreferredLocale('en', 'es-ES')).toBe('en')
    expect(resolvePreferredLocale('fr', 'en-GB')).toBe('en')
    expect(resolvePreferredLocale(null, 'fr-FR')).toBe('es')
    expect(resolvePreferredLocale(null, null)).toBe('es')
  })

  it('formats dates and numbers with locale conventions', () => {
    const date = new Date('2026-10-24T12:00:00.000Z')
    expect(formatDate(date, 'es', { dateStyle: 'short', timeZone: 'UTC' })).not.toBe(formatDate(date, 'en', { dateStyle: 'short', timeZone: 'UTC' }))
    expect(formatNumber(12345.6, 'es')).toContain(',')
    expect(formatNumber(12345.6, 'en')).toContain('.')
  })

  it('keeps both dictionaries complete for every message key', () => {
    const esKeys = Object.keys(dictionaries.es).sort()
    const enKeys = Object.keys(dictionaries.en).sort()
    expect(locales).toEqual(['es', 'en'])
    expect(enKeys).toEqual(esKeys)
  })
})
