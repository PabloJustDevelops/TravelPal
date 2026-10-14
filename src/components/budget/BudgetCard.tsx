'use client'

import { useState } from 'react'
import { 
  CurrencyDollarIcon, 
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils'
import Button from '@/components/ui/Button'

interface Budget {
  id: string
  name: string
  total_amount: number
  spent_amount: number
  currency: string
  category: string
  trip_id?: string
  trip_title?: string
  start_date: string
  end_date: string
  description?: string
  created_at: string
  updated_at: string
}

interface BudgetCardProps {
  budget: Budget
  onEdit?: (budget: Budget) => void
  onDelete?: (budgetId: string) => void
  showActions?: boolean
}

export default function BudgetCard({ 
  budget, 
  onEdit, 
  onDelete, 
  showActions = true 
}: BudgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const spentPercentage = budget.total_amount > 0 
    ? (budget.spent_amount / budget.total_amount) * 100 
    : 0
  
  const remainingAmount = budget.total_amount - budget.spent_amount
  const isOverBudget = budget.spent_amount > budget.total_amount
  const isNearLimit = spentPercentage >= 80 && !isOverBudget

  const getStatusColor = () => {
    if (isOverBudget) return 'text-danger'
    if (isNearLimit) return 'text-warning'
    return 'text-success'
  }

  const getStatusIcon = () => {
    if (isOverBudget) return <ExclamationTriangleIcon className="h-5 w-5 text-danger" />
    if (isNearLimit) return <ArrowTrendingUpIcon className="h-5 w-5 text-warning" />
    return <CheckCircleIcon className="h-5 w-5 text-success" />
  }

  const getProgressBarColor = () => {
    if (isOverBudget) return 'bg-danger'
    if (isNearLimit) return 'bg-warning'
    return 'bg-success'
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactElement> = {
      travel: <CurrencyDollarIcon className="h-5 w-5" />,
      accommodation: <CurrencyDollarIcon className="h-5 w-5" />,
      food: <CurrencyDollarIcon className="h-5 w-5" />,
      transport: <CurrencyDollarIcon className="h-5 w-5" />,
      entertainment: <CurrencyDollarIcon className="h-5 w-5" />,
      shopping: <CurrencyDollarIcon className="h-5 w-5" />,
      other: <CurrencyDollarIcon className="h-5 w-5" />,
    }
    return icons[category] || <CurrencyDollarIcon className="h-5 w-5" />
  }

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      travel: 'Viaje',
      accommodation: 'Alojamiento',
      food: 'Comida',
      transport: 'Transporte',
      entertainment: 'Entretenimiento',
      shopping: 'Compras',
      other: 'Otros',
    }
    return names[category] || category
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getDaysRemaining = () => {
    const endDate = new Date(budget.end_date)
    const today = new Date()
    const diffTime = endDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysRemaining = getDaysRemaining()

  return (
    <div className="bg-paper rounded-xl border border-line relative">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-accent-soft rounded-lg flex items-center justify-center text-accent">
                {getCategoryIcon(budget.category)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-ink truncate">
                {budget.name}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-muted">
                  {getCategoryName(budget.category)}
                </span>
                {budget.trip_title && (
                  <>
                    <span className="text-muted">•</span>
                    <span className="text-sm text-accent truncate">
                      {budget.trip_title}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            {showActions && (
              <div className="flex items-center space-x-1">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar presupuesto ${budget.name}`}
                    className="h-11 w-11 p-0"
                    onClick={() => onEdit(budget)}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Eliminar presupuesto ${budget.name}`}
                    onClick={() => onDelete(budget.id)}
                    className="h-11 w-11 p-0 text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Budget Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted">
              Gastado: {formatCurrency(budget.spent_amount, budget.currency)}
            </span>
            <span className="text-sm text-muted">
              {spentPercentage.toFixed(1)}%
            </span>
          </div>
          
          <div className="w-full bg-surface-strong rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${Math.min(spentPercentage, 100)}%` }}
            />
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <span className="text-sm text-muted">
              Presupuesto: {formatCurrency(budget.total_amount, budget.currency)}
            </span>
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {isOverBudget ? 'Excedido por' : 'Restante'}: {' '}
              {formatCurrency(Math.abs(remainingAmount), budget.currency)}
            </span>
          </div>
        </div>

        {/* Period and Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted mb-4">
          <span>
            {formatDate(budget.start_date)} - {formatDate(budget.end_date)}
          </span>
          <span className={daysRemaining > 0 ? 'text-muted' : 'text-danger'}>
            {daysRemaining > 0 
              ? `${daysRemaining} días restantes`
              : daysRemaining === 0 
                ? 'Termina hoy'
                : `Terminó hace ${Math.abs(daysRemaining)} días`
            }
          </span>
        </div>

        {/* Expandable Description */}
        {budget.description && (
          <div className="border-t border-line pt-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              {isExpanded ? 'Ocultar descripción' : 'Ver descripción'}
            </button>
            {isExpanded && (
              <p className="mt-2 text-sm text-muted leading-relaxed">
                {budget.description}
              </p>
            )}
          </div>
        )}

        {/* Status Alerts */}
        {(isOverBudget || isNearLimit) && (
          <div className={`mt-4 p-3 rounded-lg ${
            isOverBudget 
              ? 'bg-danger/10 border border-danger' 
              : 'bg-warning/10 border border-warning'
          }`}>
            <div className="flex items-center">
              {isOverBudget ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-danger mr-2" />
              ) : (
                <ArrowTrendingUpIcon className="h-5 w-5 text-warning mr-2" />
              )}
              <span className={`text-sm font-medium ${
                isOverBudget ? 'text-danger' : 'text-warning'
              }`}>
                {isOverBudget 
                  ? '¡Presupuesto excedido!'
                  : '¡Cerca del límite del presupuesto!'
                }
              </span>
            </div>
            <p className={`text-sm mt-1 ${
              isOverBudget ? 'text-danger' : 'text-warning'
            }`}>
              {isOverBudget 
                ? `Has gastado ${formatCurrency(budget.spent_amount - budget.total_amount, budget.currency)} más de lo presupuestado.`
                : `Has gastado el ${spentPercentage.toFixed(1)}% de tu presupuesto.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}