import { exportAccountData, deleteAccountData, ACCOUNT_TABLES } from '../account-data';

function sdk() {
  const events: string[] = [];
  const rows: Record<string, Record<string, unknown>[]> = {
    profiles: [{ id: 'owner', full_name: 'Nombre' }],
    journal_photos: [{ id: 'photo', user_id: 'owner', key: 'owner/photo.jpg' }],
  };
  let failure = '';
  const database = { from: jest.fn((table: string) => ({
    select: () => ({ eq: (column: string, owner: string) => ({
      order: () => ({ range: async (start: number, end: number) => {
        events.push(`read:${table}:${column}:${owner}`);
        return { data: (rows[table] ?? []).slice(start, end + 1), error: failure === 'read' ? { message: 'read failed' } : null };
      } }),
    }) }),
    delete: () => ({ eq: async (column: string, owner: string) => {
      events.push(`delete:${table}:${column}:${owner}`);
      if (failure === table) return { error: { message: 'delete failed' } };
      if (failure !== 'policy') rows[table] = [];
      return { error: null };
    } }),
  })) };
  const storage = { from: (bucket: string) => ({
    list: async ({ offset }: { offset: number }) => ({ data: { objects: offset ? [] : [{ key: 'owner/photo.jpg' }], pagination: { total: 1 } }, error: null }),
    download: async () => ({ data: new Blob(['photo'], { type: 'image/jpeg' }), error: null }),
    remove: async (key: string) => {
      events.push(`storage:${bucket}:${key}`);
      return { error: failure === 'storage' ? { message: 'storage failed' } : null };
    },
  }) };
  const auth = {
    getCurrentUser: async () => ({ data: { user: { id: 'owner', email: 'a@example.com', profile: { name: 'Nombre' } } }, error: null }),
    signOut: async () => { events.push('signOut'); return { error: failure === 'logout' ? { message: 'logout failed' } : null }; },
  };
  return { client: { database, storage, auth }, events, rows, fail: (value: string) => { failure = value; } };
}

type Client = NonNullable<Parameters<typeof exportAccountData>[0]>;

describe('portabilidad y supresión por SDK', () => {
  it('exporta identidad, todas las tablas y archivos sin truncar la paginación', async () => {
    const mock = sdk();
    mock.rows.notes = Array.from({ length: 1101 }, (_, i) => ({ id: `${i}`, user_id: 'owner' }));
    const result = await exportAccountData(mock.client as unknown as Client);
    expect(result.tables.notes).toHaveLength(1101);
    expect(Object.keys(result.tables).sort()).toEqual([...ACCOUNT_TABLES].sort());
    expect(result.identity.email).toBe('a@example.com');
    expect(result.files[0]).toMatchObject({ key: 'owner/photo.jpg', dataUrl: 'data:image/jpeg;base64,cGhvdG8=' });
    expect(mock.events.every(e => e.endsWith(':owner'))).toBe(true);
  });

  it('no entrega una exportación parcial si falla una lectura', async () => {
    const mock = sdk(); mock.fail('read');
    await expect(exportAccountData(mock.client as unknown as Client)).rejects.toThrow('read failed');
  });

  it('exige ELIMINAR antes de cualquier efecto', async () => {
    const mock = sdk();
    await expect(deleteAccountData(mock.client as unknown as Client, 'eliminar')).rejects.toThrow('ELIMINAR');
    expect(mock.events).toEqual([]);
  });

  it('borra archivos antes que filas, profiles y viajes al final, y cierra sesión sin prometer borrar auth', async () => {
    const mock = sdk();
    const result = await deleteAccountData(mock.client as unknown as Client, 'ELIMINAR');
    const deletes = mock.events.filter(e => e.startsWith('delete:'));
    expect(deletes).toHaveLength(ACCOUNT_TABLES.length);
    expect(mock.events.indexOf('storage:journal-photos:owner/photo.jpg')).toBeLessThan(mock.events.indexOf(deletes[0]));
    expect(deletes.slice(-2)).toEqual(['delete:trips:user_id:owner', 'delete:profiles:id:owner']);
    expect(mock.events.at(-1)).toBe('signOut');
    expect(result.authDeleted).toBe(false);
  });

  it.each(['storage', 'notes', 'policy', 'logout'])('informa error en %s sin fingir éxito', async (failure) => {
    const mock = sdk(); mock.fail(failure);
    await expect(deleteAccountData(mock.client as unknown as Client, 'ELIMINAR')).rejects.toThrow();
    if (failure === 'storage') expect(mock.events.some(e => e.startsWith('delete:'))).toBe(false);
    if (failure !== 'logout') expect(mock.events).not.toContain('signOut');
  });
});
