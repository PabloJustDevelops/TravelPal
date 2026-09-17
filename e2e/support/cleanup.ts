import { email, password } from './flows'

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
] as const

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
