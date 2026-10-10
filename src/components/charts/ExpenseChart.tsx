'use client'

import { useMemo } from 'react'
import { Expense } from '@/lib/insforge'
import { formatCurrency } from '@/lib/utils'
import { buildExpenseTrend } from './expenseTrend'
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts'

export interface ExpenseChartProps {
  expenses: Expense[]
  type?: 'category' | 'timeline' | 'comparison'
  title?: string
  height?: number
  currency?: string
}

interface ChartData {
  name: string
  value: number
  color: string
  percentage?: number
  [key: string]: any
}

const CATEGORY_COLORS: Record<string, string> = {
  transport: '#3B82F6',   // Blue-500
  accommodation: '#8B5CF6', // Violet-500
  food: '#F59E0B',        // Amber-500
  entertainment: '#EF4444', // Red-500
  shopping: '#10B981',    // Emerald-500
  health: '#F97316',      // Orange-500
  other: '#6B7280',       // Gray-500
}

const CATEGORY_NAMES: Record<string, string> = {
  transport: 'Transporte',
  accommodation: 'Alojamiento',
  food: 'Comida',
  entertainment: 'Entretenimiento',
  shopping: 'Compras',
  health: 'Salud',
  other: 'Otros',
}

const CustomTooltip = ({ active, payload, currency }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface p-3 border border-line shadow-lg rounded-lg">
        <p className="text-sm font-semibold text-ink mb-1">
          {data.name}
        </p>
        <p className="text-sm text-muted">
          {formatCurrency(data.value, currency)}
          {data.percentage && <span className="text-xs text-muted ml-2">({data.percentage.toFixed(1)}%)</span>}
        </p>
      </div>
    );
  }
  return null;
};

export default function ExpenseChart({ 
  expenses, 
  type = 'category', 
  title = 'Gastos por categoría',
  height = 320,
  currency = 'USD'
}: ExpenseChartProps) {
  const data = useMemo<ChartData[]>(() => {
    const currencyExpenses = (expenses ?? []).filter((expense) => expense.currency === currency)
    if (currencyExpenses.length === 0) return []

    const totalAmount = currencyExpenses.reduce((sum, expense) => sum + expense.amount, 0)

    if (type === 'category') {
      const categoryTotals = currencyExpenses.reduce((acc, expense) => {
        const cat = expense.category || 'other'
        acc[cat] = (acc[cat] || 0) + expense.amount
        return acc
      }, {} as Record<string, number>)

      const processedData = Object.entries(categoryTotals)
        .map(([key, value]) => ({
          name: CATEGORY_NAMES[key] || key,
          value: value,
          color: CATEGORY_COLORS[key] || CATEGORY_COLORS.other,
          percentage: (value / totalAmount) * 100
        }))
        .sort((a, b) => b.value - a.value)

      return processedData
    }

    if (type === 'timeline') return buildExpenseTrend(currencyExpenses)
    return []
  }, [expenses, type, currency])

  if (data.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center bg-surface-strong rounded-lg border border-dashed border-line">
        <p className="text-muted text-sm">No hay datos suficientes</p>
      </div>
    )
  }

  return (
    <div role="img" aria-label={title} className="w-full h-full min-h-[320px]">
      <ResponsiveContainer width="100%" height={height}>
        {type === 'category' ? (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Legend 
              verticalAlign="middle" 
              align="right"
              layout="vertical"
              iconType="circle"
              formatter={(value) => (
                <span className="text-sm text-muted ml-2">
                  {value}
                </span>
              )}
            />
          </PieChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#6B7280', fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value, currency)}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              content={<CustomTooltip currency={currency} />}
            />
            <Bar 
              dataKey="value" 
              radius={[4, 4, 0, 0]}
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || '#3B82F6'} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
