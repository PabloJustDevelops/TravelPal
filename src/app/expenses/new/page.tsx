'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { createInsforgeClient, Trip } from '@/lib/insforge'
import { queryErrorKind, withQueryTimeout } from '@/lib/insforge-query'
import { CONNECTION_TIMEOUT_MESSAGE } from '@/lib/utils'
import { logger } from '@/lib/logger'
import PageTitle from '@/components/ui/PageTitle'
import ExpenseSummary from '@/components/expenses/ExpenseSummary'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { selectClassName, textareaClassName } from '@/components/ui/fieldStyles'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { Card, CardContent } from '@/components/ui/Card'

export default function NewExpensePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'EUR',
    category: 'other' as const,
    date: new Date().toISOString().slice(0, 16),
    trip_id: '',
    notes: '',
  })

  const loadTrips = useCallback(async (userId: string) => {
    setTripsLoading(true)
    try {
      // Los viajes alimentan el selector: se leen del SDK, no del BFF.
      const insforge = createInsforgeClient()
      const { data, error } = await withQueryTimeout(
        insforge
          .database.from('trips')
          .select('*')
          .eq('user_id', userId)
          .order('departure_date', { ascending: false }),
        { label: 'trips' },
      )

      if (error) throw error
      setTrips((data as Trip[]) || [])
    } catch (error) {
      console.error('Error loading trips:', error)
      // No bloqueamos la UI si fallan los viajes, solo no aparecen en el selector
    } finally {
      setTripsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.id) {
      loadTrips(user.id)
    }
  }, [user?.id, loadTrips])

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
      setError('Debes iniciar sesión para registrar un gasto')
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

      // Mismo objeto de insercion que el POST borrado: el formulario manda
      // `description` y la columna `title` es NOT NULL, asi que se mapea; lo que
      // el formulario llama `notes` va a la columna `description`.
      const newExpense = {
        user_id: user.id,
        title: formData.description,
        amount: amount,
        currency: formData.currency || 'EUR',
        category: formData.category || 'other',
        date: formData.date,
        trip_id: formData.trip_id || null,
        description: formData.notes || null,
      }

      logger.debug('Enviando datos de gasto al SDK:', newExpense)

      const insforge = createInsforgeClient()
      const { error } = await withQueryTimeout(
        insforge
          .database.from('expenses')
          .insert([newExpense])
          .select()
          .single(),
        { label: 'expenses:insert' },
      )

      if (error) throw error

      router.push('/expenses')
    } catch (error: unknown) {
      logger.error('NewExpensePage: Error al registrar el gasto', error)

      if (queryErrorKind(error) === 'timeout') {
        setError(CONNECTION_TIMEOUT_MESSAGE)
        return
      }

      let errorMessage = 'Error al registrar el gasto'
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

  return (
    <DashboardLayout skeleton="expenses/new" pending={authLoading || (!!user && tripsLoading)}>
      <div className="mx-auto space-y-7">
        <div className="space-y-2"><Link href="/expenses" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted hover:text-accent"><ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />Volver a gastos</Link><PageTitle title="Un gasto más, todo en orden." subtitle="Guárdalo ahora y sigue con tu viaje."/></div>
        {/* Form */}
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.8fr)]"><Card className="min-w-0 rounded-none border-0 bg-transparent">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div role="alert" className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Basic Information */}
              <div className="space-y-4">
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
                    <label htmlFor="expense-currency" className="block text-sm font-medium text-ink">
                      Moneda *
                    </label>
                    <select
                      id="expense-currency"
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

                <Input
                  label="Descripción *"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="ej. Cena en restaurante"
                  required
                />


                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-ink">Categoría *</legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {categories.map((category) => (
                      <label
                        key={category.value}
                        className={`relative flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper ${
                          formData.category === category.value
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-paper text-muted hover:border-accent'
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
                          className="h-6 w-6 mb-1 text-muted"
                        />
                        <span className="text-xs text-center font-medium">
                          {category.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Input
                  label="Fecha y Hora *"
                  name="date"
                  type="datetime-local"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />

                <div className="space-y-2">
                  <label htmlFor="expense-trip_id" className="block text-sm font-medium text-ink">
                    Viaje Asociado
                  </label>
                  <select
                    id="expense-trip_id"
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
                  <p className="text-xs text-muted">
                    Opcional: Asocia este gasto a un viaje específico
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="expense-notes" className="block text-sm font-medium text-ink">
                    Notas Adicionales
                  </label>
                  <textarea
                    id="expense-notes"
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
                  className="min-h-11 flex-1 sm:flex-none"
                >
                  Registrar Gasto
                </Button>
                <Link href="/expenses" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-line px-4 font-medium text-ink hover:bg-surface sm:flex-none">
                  Cancelar
                </Link>
              </div>
            </form>
          </CardContent>
        </Card><ExpenseSummary data={formData} trips={trips} categoryLabel={categories.find(category=>category.value===formData.category)?.label}/></div>
      </div>
    </DashboardLayout>
  )
}
