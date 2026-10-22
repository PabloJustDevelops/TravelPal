import { createInsforgeClient, JOURNAL_PHOTOS_BUCKET } from './insforge';

type Client = ReturnType<typeof createInsforgeClient>;
type Row = Record<string, unknown>;
// Hijas primero: evita perder referencias de archivos por un cascade de trips.
export const ACCOUNT_TABLES = [
  'journal_photos', 'journal_entries', 'itinerary_activities', 'bookings',
  'expenses', 'budgets', 'notes', 'tasks', 'alerts', 'trips', 'profiles',
] as const;
type Table = typeof ACCOUNT_TABLES[number];
const PAGE_SIZE = 500;
const BUCKETS = [JOURNAL_PHOTOS_BUCKET, 'avatars'] as const;

function check(error: { message: string } | null, step: string) {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function identity(client: Client) {
  const { data, error } = await client.auth.getCurrentUser();
  check(error, 'No se pudo comprobar la sesión');
  if (!data?.user?.id) throw new Error('Necesitas una sesión activa');
  // Exportar identidad, nunca tokens ni credenciales de sesión.
  return { id: data.user.id, email: data.user.email, profile: data.user.profile };
}

async function readTable(client: Client, table: Table, userId: string) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.database.from(table).select('*')
      .eq(table === 'profiles' ? 'id' : 'user_id', userId)
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    check(error, `No se pudo leer ${table}`);
    if (!data) throw new Error(`Respuesta vacía al leer ${table}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function listFiles(client: Client, bucket: string) {
  const keys: string[] = [];
  // RLS de storage.objects filtra por uploaded_by; incluye objetos huérfanos y
  // avatares antiguos, sin confiar en el prefijo del nombre como autorización.
  for (let offset = 0; ; ) {
    const { data, error } = await client.storage.from(bucket).list({ limit: PAGE_SIZE, offset });
    check(error, `No se pudieron listar archivos de ${bucket}`);
    if (!data) throw new Error(`Respuesta vacía al listar ${bucket}`);
    keys.push(...data.objects.map(object => object.key));
    offset += data.objects.length;
    if (offset >= data.pagination.total) return keys;
    if (!data.objects.length) throw new Error(`Listado incompleto de ${bucket}`);
  }
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo codificar un archivo'));
    reader.readAsDataURL(blob);
  });
}

export async function exportAccountData(client: Client = createInsforgeClient()) {
  const user = await identity(client);
  const tables = {} as Record<Table, Row[]>;
  for (const table of ACCOUNT_TABLES) tables[table] = await readTable(client, table, user.id);
  const files: { bucket: string; key: string; dataUrl: string }[] = [];
  for (const bucket of BUCKETS) {
    for (const key of await listFiles(client, bucket)) {
      const { data, error } = await client.storage.from(bucket).download(key);
      check(error, `No se pudo descargar ${bucket}/${key}`);
      if (!data) throw new Error(`Archivo vacío: ${bucket}/${key}`);
      files.push({ bucket, key, dataUrl: await dataUrl(data) });
    }
  }
  return { version: 1, exportedAt: new Date().toISOString(), identity: user, tables, files };
}

export async function deleteAccountData(client: Client, confirmation: string) {
  if (confirmation !== 'ELIMINAR') throw new Error('Escribe ELIMINAR para confirmar');
  const user = await identity(client);
  // Preflight antes de destruir nada. Una migración de perfiles pendiente se
  // detecta después del DELETE mediante lectura: PostgREST puede devolver 0 filas.
  for (const table of ACCOUNT_TABLES) await readTable(client, table, user.id);
  for (const bucket of BUCKETS) {
    const keys = await listFiles(client, bucket);
    for (const key of keys) {
      const { error } = await client.storage.from(bucket).remove(key);
      check(error, `No se pudo borrar ${bucket}/${key}`);
    }
  }
  for (const table of ACCOUNT_TABLES) {
    const { error } = await client.database.from(table).delete()
      .eq(table === 'profiles' ? 'id' : 'user_id', user.id);
    check(error, `No se pudo borrar ${table}. El borrado puede ser parcial; vuelve a intentarlo`);
    if ((await readTable(client, table, user.id)).length) {
      throw new Error(`Quedan filas en ${table}. Borrado incompleto; contacta con el responsable (puede faltar una política RLS)`);
    }
  }
  // SDK 1.5.2 no tiene auto-borrado de auth. No simularlo ni usar claves admin.
  const { error } = await client.auth.signOut();
  check(error, 'Datos borrados; no se pudo cerrar la sesión. Ciérrala e informa al responsable para eliminar tu identidad de acceso');
  return { authDeleted: false as const };
}

export function downloadAccountExport(data: Awaited<ReturnType<typeof exportAccountData>>) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `travelpal-datos-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
