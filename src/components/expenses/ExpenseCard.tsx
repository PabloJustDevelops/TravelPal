'use client'

import { Expense } from '@/lib/insforge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  CalendarIcon,
  TagIcon,
  DocumentTextIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import Button from '@/components/ui/Button'
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

  const getCategoryColor = (category: Expense['category']) => {
    switch (category) {
      case 'accommodation':
        return 'bg-blue-100 text-blue-800'
      case 'transport':
        return 'bg-green-100 text-green-800'
      case 'food':
        return 'bg-orange-100 text-orange-800'
      case 'entertainment':
        return 'bg-purple-100 text-purple-800'
      case 'shopping':
        return 'bg-pink-100 text-pink-800'
      case 'health':
        return 'bg-red-100 text-red-800'
      case 'insurance':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow relative group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <CategoryIcon
              category={expense.category}
              className="h-5 w-5 text-muted"
            />
            <span>{expense.title || expense.description}</span>
          </CardTitle>
          <div className="text-right flex flex-col items-end">
             <Link href={`/expenses/${expense.id}/edit`} aria-label="Editar gasto">
               <Button
                 variant="ghost"
                 size="sm"
                 aria-label="Editar gasto"
                 className="opacity-0 group-hover:opacity-100 transition-opacity mb-1"
               >
                 <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
               </Button>
             </Link>
            <div className="text-lg font-bold text-ink">
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
        {/* Category */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TagIcon className="h-4 w-4 text-muted" />
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(
                expense.category
              )}`}
            >
              {getCategoryName(expense.category)}
            </span>
          </div>
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