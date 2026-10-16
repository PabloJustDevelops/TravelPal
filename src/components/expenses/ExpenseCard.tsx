'use client'

import { Expense } from '@/lib/insforge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  CalendarIcon,
  DocumentTextIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import CategoryIcon from '@/components/ui/CategoryIcon'

interface ExpenseWithTrip extends Expense {
  trip: {
    title: string
  }
}

interface ExpenseWithNotes extends Expense {
  notes: string
}

interface ExpenseCardProps {
  expense: Expense | ExpenseWithTrip | ExpenseWithNotes
  showTripTitle?: boolean
}

export default function ExpenseCard({ expense, showTripTitle = false }: ExpenseCardProps) {
  const getCategoryName = (category: Expense['category']) => {
    switch (category) {
      case 'accommodation':
        return 'Alojamiento'
      case 'transport':
        return 'Transporte'
      case 'food':
        return 'Comida'
      case 'entertainment':
        return 'Entretenimiento'
      case 'shopping':
        return 'Compras'
      case 'health':
        return 'Salud'
      case 'insurance':
        return 'Seguro'
      default:
        return 'Otros'
    }
  }

  return (
    <Card className="relative">
      <CardHeader className="border-b-0 pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle headingLevel={2} className="min-w-0 text-base flex items-center gap-2">
            <CategoryIcon
              category={expense.category}
              className="h-5 w-5 text-muted"
            />
            <span className="break-words">{expense.title || expense.description}</span>
          </CardTitle>
          <div className="text-right flex flex-col items-end">
            <div className="text-xl font-semibold tabular-nums tracking-tight text-ink">
              {formatCurrency(expense.amount, expense.currency)}
            </div>
            {showTripTitle && (expense as ExpenseWithTrip).trip && (
               <div className="text-xs text-muted mt-1">
                 {(expense as ExpenseWithTrip).trip.title}
               </div>
             )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted">{getCategoryName(expense.category)}</span>
          <Link href={`/expense-edit?id=${encodeURIComponent(expense.id)}`} aria-label={`Editar gasto ${expense.title || expense.description}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Date */}
        <div className="flex items-center space-x-2 text-muted">
          <CalendarIcon className="h-4 w-4" />
          <span className="text-sm">{formatDate(expense.date)}</span>
        </div>

        {/* Notes */}
         {(expense as ExpenseWithNotes).notes && (
           <div className="flex items-start space-x-2 text-muted">
             <DocumentTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
             <span className="text-sm line-clamp-2">{(expense as ExpenseWithNotes).notes}</span>
           </div>
         )}

        {/* Receipt indicator */}
        {expense.receipt_url && (
          <div className="flex items-center space-x-2 text-success">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-xs font-medium">Recibo adjunto</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
