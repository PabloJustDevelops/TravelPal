import { Expense } from '@/lib/insforge'

export interface ExpenseTrendPoint {
  name: string
  value: number
  color: string
  currency: string
}

type TrendExpense = Pick<Expense, 'date' | 'amount' | 'currency'>

const TREND_COLOR = '#3B82F6'

// Agrupa por mes natural usando una clave ordenable ("aaaa-mm"), no el texto
// del mes: asi dos "enero" de anos distintos no se confunden, y los meses
// salen en orden cronologico aunque los gastos lleguen desordenados.
export function buildExpenseTrend(
  expenses: TrendExpense[]
): ExpenseTrendPoint[] {
  const months = new Map<string, { name: string; value: number; currency: string }>()

  for (const expense of expenses) {
    const date = new Date(expense.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${expense.currency}`
    const month = months.get(key)

    if (month) {
      month.value += expense.amount
    } else {
        months.set(key, {
          name: date.toLocaleDateString('es-ES', {
            month: 'short',
            year: 'numeric',
          }),
          value: expense.amount,
          currency: expense.currency,
        })
    }
  }

  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, { name, value, currency }]) => ({ name, value, color: TREND_COLOR, currency }))
}
