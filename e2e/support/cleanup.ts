import { email, password, toDateTimeLocal } from './flows'

// La app ya ofrece borrar un viaje por la UI (en la lista y en el detalle),
// pero la limpieza no depende de que el flujo llegue hasta ahi: si un test falla
// antes, el viaje se quedaria en produccion. Se va por el SDK con la sesion del
// propio usuario dedicado: RLS sigue mandando y solo se toca lo que creo el test.
async function signedInClient() {
  const { createClient } = await import('@insforge/sdk')
  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  })

  const { error } = await client.auth.signInWithPassword({
    method: 'password',
    email,
    password,
  })
  if (error) throw new Error(`Limpieza: no se pudo iniciar sesion (${error.message})`)

  return client
}

// Tablas con `trip_id` que hay que vaciar antes del viaje: las que cascadean lo
// harian solas, pero `expenses` tiene `on delete set null` y quedaria suelta.
const TRIP_CHILD_TABLES = [
  'journal_photos',
  'journal_entries',
  'itinerary_activities',
  'expenses',
  'bookings',
  'notes',
  'budgets',
] as const

export interface DashboardFixture {
  tripTitle: string
  activityTitle: string
  taskTitle: string
  budgetName: string
  date: string
}

export async function dashboardFixtureDates(): Promise<{ departure: string; returnDate: string }> {
  const client = await signedInClient()
  const { data, error } = await client
    .database.from('trips')
    .select('departure_date, return_date, status')
    .in('status', ['planned', 'confirmed'])
    .order('departure_date', { ascending: true })
    .limit(500)
  if (error) throw new Error(`Dashboard E2E: no se pudieron leer los viajes (${error.message})`)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayText = toDateTimeLocal(today).slice(0, 10)
  const eligible = ((data ?? []) as Array<{ departure_date: string; return_date: string | null }>)
    .filter((trip) => dashboardLocalDay(trip.return_date || trip.departure_date) >= todayText)
  const earliestDeparture = eligible
    .map((trip) => dashboardLocalDay(trip.departure_date))
    .sort()[0]

  const departureDay = earliestDeparture && earliestDeparture < todayText
    ? earliestDeparture
    : todayText
  const departure = new Date(`${departureDay}T09:00:00`)
  departure.setDate(departure.getDate() - 1)
  departure.setHours(9, 0, 0, 0)

  const returnDate = new Date(today)
  returnDate.setHours(23, 0, 0, 0)
  return {
    departure: toDateTimeLocal(departure),
    returnDate: toDateTimeLocal(returnDate),
  }
}

function dashboardLocalDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return toDateTimeLocal(date).slice(0, 10)
}

export async function createDashboardFixture(fixture: DashboardFixture): Promise<void> {
  const client = await signedInClient()
  const { data, error } = await client
    .database.from('trips')
    .select('id, user_id')
    .eq('title', fixture.tripTitle)
    .limit(1)
  if (error) throw new Error(`Dashboard E2E: no se pudo leer el viaje (${error.message})`)

  const trip = (data ?? [])[0] as { id: string; user_id: string } | undefined
  if (!trip) throw new Error(`Dashboard E2E: no existe el viaje ${fixture.tripTitle}`)

  const { data: existingTasks, error: tasksError } = await client
    .database.from('tasks')
    .select('due_date')
    .eq('user_id', trip.user_id)
    .neq('status', 'completed')
    .order('due_date', { ascending: true })
    .limit(1)
  if (tasksError) throw new Error(`Dashboard E2E: no se pudieron leer las tareas (${tasksError.message})`)

  const earliestTaskDate = (existingTasks ?? [])[0] as { due_date: string | null } | undefined
  const dueDate = earliestTaskDate?.due_date ? new Date(earliestTaskDate.due_date) : new Date()
  dueDate.setDate(dueDate.getDate() - 1)

  const day = new Date(`${fixture.date}T12:00:00.000Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  const budgetStart = day.toISOString().slice(0, 10)
  day.setUTCDate(day.getUTCDate() + 3)
  const budgetEnd = day.toISOString().slice(0, 10)

  const inserts = [
    {
      table: 'itinerary_activities',
      row: {
        user_id: trip.user_id,
        trip_id: trip.id,
        date: fixture.date,
        title: fixture.activityTitle,
        description: 'Visita del escenario de QA del dashboard.',
        start_time: '10:00:00',
        end_time: '11:30:00',
        location: 'Centro histórico',
        category: 'activity',
        currency: 'EUR',
      },
    },
    {
      table: 'tasks',
      row: {
        user_id: trip.user_id,
        title: fixture.taskTitle,
        description: 'Tarea del escenario de QA del dashboard.',
        status: 'pending',
        priority: 'medium',
        due_date: dueDate.toISOString(),
      },
    },
    {
      table: 'budgets',
      row: {
        user_id: trip.user_id,
        trip_id: trip.id,
        name: fixture.budgetName,
        total_amount: 500,
        spent_amount: 0,
        currency: 'EUR',
        category: 'travel',
        start_date: budgetStart,
        end_date: budgetEnd,
        description: 'Presupuesto del escenario de QA del dashboard.',
      },
    },
    {
      table: 'expenses',
      row: {
        user_id: trip.user_id,
        trip_id: trip.id,
        title: `${fixture.budgetName}-gasto`,
        amount: 83.5,
        currency: 'EUR',
        category: 'food',
        date: `${fixture.date}T12:00:00.000Z`,
        description: 'Gasto del escenario de QA del dashboard.',
      },
    },
  ] as const

  for (const insert of inserts) {
    const { error: insertError } = await client.database.from(insert.table).insert([insert.row])
    if (insertError) {
      throw new Error(`Dashboard E2E: no se pudo crear ${insert.table} (${insertError.message})`)
    }
  }
}

export interface ExpenseFixture {
  title: string
  amount: number
  category: string
  tripTitle: string
}

// Un gasto colgado de un viaje por el mismo camino que la app (SDK + RLS): el
// viaje se localiza por su titulo y el `user_id` sale de la propia fila. Sirve
// para dejar el escenario listo sin depender del formulario.
export async function createExpense(fixture: ExpenseFixture): Promise<void> {
  const client = await signedInClient()

  const { data, error } = await client
    .database.from('trips')
    .select('id, user_id')
    .eq('title', fixture.tripTitle)
  if (error) throw new Error(`Gastos: no se pudo leer el viaje (${error.message})`)

  const trips = (data ?? []) as Array<{ id: string; user_id: string }>
  if (trips.length === 0) throw new Error(`Gastos: no existe el viaje ${fixture.tripTitle}`)

  const { error: insertError } = await client.database.from('expenses').insert([
    {
      user_id: trips[0].user_id,
      trip_id: trips[0].id,
      title: fixture.title,
      amount: fixture.amount,
      category: fixture.category,
      date: new Date().toISOString(),
    },
  ])
  if (insertError) throw new Error(`Gastos: no se pudo crear el gasto (${insertError.message})`)
}

export async function deleteExpense(title: string): Promise<void> {
  const client = await signedInClient()

  const { error } = await client.database.from('expenses').delete().eq('title', title)
  if (error) throw new Error(`Limpieza: no se pudo borrar el gasto (${error.message})`)
}

export async function deleteTrip(title: string): Promise<void> {
  const client = await signedInClient()

  await deleteTripsWithClient(client, title)
}

export async function deleteDashboardFixture(tripTitle: string, taskTitle: string): Promise<void> {
  const client = await signedInClient()
  const { error: taskError } = await client.database.from('tasks').delete().eq('title', taskTitle)
  let tripError: unknown
  try {
    await deleteTripsWithClient(client, tripTitle)
  } catch (error) {
    tripError = error
  }

  const failures = [
    taskError && `tarea (${taskError.message})`,
    tripError instanceof Error && tripError.message,
  ].filter(Boolean)
  if (failures.length > 0) throw new Error(`Limpieza del dashboard E2E: ${failures.join('; ')}`)
}

async function deleteTripsWithClient(
  client: Awaited<ReturnType<typeof signedInClient>>,
  title: string,
): Promise<void> {

  const { data, error } = await client
    .database.from('trips')
    .select('id')
    .eq('title', title)
  if (error) throw new Error(`Limpieza: no se pudo leer el viaje (${error.message})`)

  for (const trip of (data ?? []) as Array<{ id: string }>) {
    const photos = await client
      .database.from('journal_photos')
      .select('key')
      .eq('trip_id', trip.id)
    const keys = ((photos.data ?? []) as Array<{ key: string }>).map((row) => row.key)
    if (keys.length > 0) {
      const { error: storageError } = await client.storage
        .from('journal-photos')
        .remove(keys)
      if (storageError) throw new Error(`Limpieza: no se pudo vaciar el bucket (${storageError.message})`)
    }

    for (const table of TRIP_CHILD_TABLES) {
      const { error: childError } = await client
        .database.from(table)
        .delete()
        .eq('trip_id', trip.id)
      if (childError) throw new Error(`Limpieza: no se pudo borrar ${table} (${childError.message})`)
    }

    const { error: tripError } = await client
      .database.from('trips')
      .delete()
      .eq('id', trip.id)
    if (tripError) throw new Error(`Limpieza: no se pudo borrar el viaje (${tripError.message})`)
  }
}
