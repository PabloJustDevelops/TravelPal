import { email, password } from './flows'

// La app no ofrece ninguna via para borrar un viaje que funcione: /trips solo
// edita y el menu contextual del calendario de /planning no llega a pintar los
// eventos de tipo `trip` (compara `event.date`, un timestamptz, contra
// 'yyyy-MM-dd'), asi que el borrado por UI no es posible hoy. Para no dejar
// basura en produccion, la limpieza va por el SDK con la sesion del propio
// usuario dedicado: RLS sigue mandando y solo se toca lo que creo el test.
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
