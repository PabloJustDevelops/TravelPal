import { buildExpenseTrend } from '../expenseTrend'

const expense = (date: string, amount: number, currency = "USD") => ({ date, amount, currency })

describe('buildExpenseTrend', () => {
  it('ordena los meses cronologicamente aunque los gastos lleguen desordenados', () => {
    const trend = buildExpenseTrend([
      expense('2026-04-10', 40),
      expense('2025-01-15', 10),
      expense('2025-04-20', 20),
      expense('2026-01-05', 30),
    ])

    expect(trend.map((point) => point.value)).toEqual([10, 20, 30, 40])
    expect(trend.map((point) => point.name)).toEqual([
      expect.stringContaining('2025'),
      expect.stringContaining('2025'),
      expect.stringContaining('2026'),
      expect.stringContaining('2026'),
    ])
  })

  it('no mezcla el mismo mes de anos distintos', () => {
    const trend = buildExpenseTrend([
      expense('2026-01-05', 30),
      expense('2025-01-15', 10),
    ])

    expect(trend).toHaveLength(2)
    expect(trend[0].name).not.toBe(trend[1].name)
    expect(trend.map((point) => point.value)).toEqual([10, 30])
  })

  it('suma en un mismo mes los gastos que caen dentro de el', () => {
    const trend = buildExpenseTrend([
      expense('2025-03-02', 10),
      expense('2025-03-28', 5),
    ])

    expect(trend).toHaveLength(1)
    expect(trend[0].value).toBe(15)
  })

  it('mantiene separados los importes del mismo mes en monedas distintas', () => {
    const trend = buildExpenseTrend([
      { date: '2025-03-02', amount: 120, currency: 'USD' },
      { date: '2025-03-28', amount: 80, currency: 'EUR' },
    ])

    expect(trend).toHaveLength(2)
    expect(trend).toMatchObject([
      { currency: 'EUR', value: 80 },
      { currency: 'USD', value: 120 },
    ])
  })
})
