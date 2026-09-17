'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { createInsforgeClient, Trip, Expense } from '@/lib/insforge'
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from '@/lib/insforge-query'
import { CONNECTION_TIMEOUT_MESSAGE, getLoadErrorMessage } from '@/lib/utils'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { selectClassName, textareaClassName } from '@/components/ui/fieldStyles'
import CategoryIcon from '@/components/ui/CategoryIcon'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { logger } from '@/lib/logger'

export default function EditExpensePage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind
  } | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'EUR',
    category: 'other' as const,
    date: new Date().toISOString().slice(0, 16),
    trip_id: '',
    notes: '',
  })

  const loadData = useCallback(async () => {
    const userId = user?.id
    if (!userId) return

    try {
      setLoadingData(true)
      setLoadError(null)
      
      // Cargar viajes para el selector
      try {
        const insforge = createInsforgeClient()
        const { data: tripsData, error: tripsError } = await withQueryTimeout(
          insforge
            .database.from('trips')
            .select('*')
            .eq('user_id', userId)
            .order('departure_date', { ascending: false }),
          { label: 'trips' },
        )

        if (tripsError) throw tripsError
        setTrips((tripsData as Trip[]) || [])
      } catch (tripsError) {
        // No bloqueamos la UI si fallan los viajes, solo no aparecen en el selector.
        logger.error('Error loading trips:', tripsError)
      }

      // Cargar datos del gasto: misma lectura que el GET borrado (`select('*')`,
      // por `id` y por `user_id`).
      const insforge = createInsforgeClient()
      const { data, error } = await withQueryTimeout(
        insforge
          .database.from('expenses')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single(),
        { label: 'expenses:detail' },
      )

      if (error) throw error

      const expense = data as Expense
      
      setFormData({
        description: expense.title || expense.description || '',
        amount: expense.amount.toString(),
        currency: expense.currency,
        category: expense.category as any,
        date: new Date(expense.date).toISOString().slice(0, 16),
        trip_id: expense.trip_id || '',
        notes: expense.description || '', // Mapping description back to notes if title is used as main desc
      })
      
    } catch (error) {
      logger.error('Error loading expense data:', error)
      setLoadError({ kind: queryErrorKind(error) })
    } finally {
      setLoadingData(false)
    }
  }, [id, user?.id])

  useEffect(() => {
    if (user && id) {
      loadData()
    }
  }, [user, id, loadData])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      setError('Debes iniciar sesión para actualizar el gasto')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Validate required fields
      if (!formData.description || !formData.amount || !formData.date) {
        throw new Error('Por favor completa todos los campos requeridos')
      }

      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('El monto debe ser un número válido mayor a 0')
      }

      // Mismo objeto de actualizacion que el PUT borrado: `title` (NOT NULL) sale
      // de `description`, la columna `description` sale de `notes` y `updated_at`
      // lo fija el propio handler.
      const insforge = createInsforgeClient()
      const { data: updatedRows, error } = await withQueryTimeout(
        insforge
          .database.from('expenses')
          .update({
            title: formData.description,
            amount: amount,
            currency: formData.currency || 'EUR',
            category: formData.category || 'other',
            date: formData.date,
            trip_id: formData.trip_id || null,
            description: formData.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select(),
        { label: 'expenses:update' },
      )

      if (error) throw error
      assertRowsAffected(updatedRows, 'No se pudo actualizar el gasto')

      router.push('/expenses')
      router.refresh()
    } catch (error: unknown) {
      logger.error('EditExpensePage: Error al actualizar el gasto', error)

      if (queryErrorKind(error) === 'timeout') {
        setError(CONNECTION_TIMEOUT_MESSAGE)
        return
      }

      let errorMessage = 'Error al actualizar el gasto'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error
      ) {
        errorMessage = (error as { message: string }).message
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este gasto?')) return
    if (!user) return
    
    setLoading(true)
    try {
      const insforge = createInsforgeClient()
      const { data: deletedRows, error } = await withQueryTimeout(
        insforge
          .database.from('expenses')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)
          .select(),
        { label: 'expenses:delete' },
      )

      if (error) throw error
      assertRowsAffected(deletedRows, 'No se pudo eliminar el gasto')

      router.push('/expenses')
      router.refresh()
    } catch (error) {
      logger.error('EditExpensePage: Error al eliminar el gasto', error)
      setError(
        queryErrorKind(error) === 'timeout'
          ? CONNECTION_TIMEOUT_MESSAGE
          : 'Error al eliminar el gasto',
      )
      setLoading(false)
    }
  }

  const categories = [
    { value: 'accommodation', label: 'Alojamiento' },
    { value: 'transport', label: 'Transporte' },
    { value: 'food', label: 'Comida' },
    { value: 'entertainment', label: 'Entretenimiento' },
    { value: 'shopping', label: 'Compras' },
    { value: 'health', label: 'Salud' },
    { value: 'insurance', label: 'Seguro' },
    { value: 'other', label: 'Otros' },
  ]

  const currencies = [
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'USD', label: 'USD ($)' },
    { value: 'GBP', label: 'GBP (£)' },
    { value: 'JPY', label: 'JPY (¥)' },
  ]

  const loadErrorMessage = getLoadErrorMessage(loadError, {
    timeout: CONNECTION_TIMEOUT_MESSAGE,
    request: 'Error al cargar los datos del gasto',
  })

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (loadErrorMessage) {
    return (
      <DashboardLayout>
        <ErrorState
          title="No se pudo cargar el gasto"
          message={loadErrorMessage}
          onRetry={() => loadData()}
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/expenses">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Editar Gasto</h1>
              <p className="text-sm text-gray-500">Modifica los detalles del gasto</p>
            </div>
          </div>
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDelete}>
            Eliminar
          </Button>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Basic Information */}
              <div className="space-y-4">
                <Input
                  label="Descripción *"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="ej. Cena en restaurante"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Monto *"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                  />
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Moneda *
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      className={selectClassName}
                      required
                    >
                      {currencies.map((currency) => (
                        <option key={currency.value} value={currency.value}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Categoría *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {categories.map((category) => (
                      <label
                        key={category.value}
                        className={`relative flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.category === category.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={category.value}
                          checked={formData.category === category.value}
                          onChange={handleInputChange}
                          className="sr-only"
                        />
                        <CategoryIcon
                          category={category.value}
                          className="h-6 w-6 mb-1 text-gray-600"
                        />
                        <span className="text-xs text-center font-medium">
                          {category.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <Input
                  label="Fecha y Hora *"
                  name="date"
                  type="datetime-local"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Viaje Asociado
                  </label>
                  <select
                    name="trip_id"
                    value={formData.trip_id}
                    onChange={handleInputChange}
                    className={selectClassName}
                  >
                    <option value="">Sin viaje asociado</option>
                    {trips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Notas Adicionales
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className={textareaClassName}
                    placeholder="Añade detalles adicionales sobre este gasto..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <Button
                  type="submit"
                  loading={loading}
                  className="flex-1 sm:flex-none"
                >
                  Guardar Cambios
                </Button>
                <Link href="/expenses" className="flex-1 sm:flex-none">
                  <Button variant="outline" className="w-full">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}