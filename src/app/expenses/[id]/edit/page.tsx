'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { createInsforgeClient, Trip, Expense } from '@/lib/insforge'
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
  const [loadError, setLoadError] = useState('')
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
    try {
      setLoadingData(true)
      setLoadError('')
      
      // Cargar viajes para el selector
      if (user?.id) {
        try {
          const insforge = createInsforgeClient()
          const { data: tripsData, error: tripsError } = await insforge
            .database.from('trips')
            .select('*')
            .eq('user_id', user.id)
            .order('departure_date', { ascending: false })

          if (tripsError) throw tripsError
          setTrips((tripsData as Trip[]) || [])
        } catch (tripsError) {
          // No bloqueamos la UI si fallan los viajes, solo no aparecen en el selector.
          logger.error('Error loading trips:', tripsError)
        }
      }

      // Cargar datos del gasto
      // Usaremos la API general filtrada o una específica si la creamos
      // Por ahora vamos a asumir que necesitamos un endpoint GET /api/expenses/[id]
      // Si no existe, tendremos que implementarlo
      const expenseRes = await fetch(`/api/expenses/${id}`)
      
      if (!expenseRes.ok) {
        throw new Error('No se pudo cargar el gasto')
      }

      const expense: Expense = await expenseRes.json()
      
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
      setLoadError('Error al cargar los datos del gasto')
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

      const expenseData = {
        description: formData.description,
        amount: amount,
        currency: formData.currency,
        category: formData.category,
        date: formData.date,
        trip_id: formData.trip_id || null,
        notes: formData.notes,
      }

      console.log('Actualizando datos de gasto:', expenseData)

      const res = await fetch(`/api/expenses/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expenseData)
      })

      if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Error al actualizar el gasto')
      }

      router.push('/expenses')
      router.refresh()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar el gasto'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este gasto?')) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Error al eliminar el gasto')
      }

      router.push('/expenses')
      router.refresh()
    } catch (error) {
      console.error(error)
      setError('Error al eliminar el gasto')
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

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <ErrorState
          title="No se pudo cargar el gasto"
          message={loadError}
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