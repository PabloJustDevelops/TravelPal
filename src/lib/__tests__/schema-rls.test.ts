import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

const baseSchema = readFileSync(
  path.join(MIGRATIONS_DIR, "20260913181842_create-app-schema.sql"),
  "utf8",
);

const flightMigrationName = readdirSync(MIGRATIONS_DIR).find((file) =>
  file.endsWith("_add-flight-fields-to-bookings.sql"),
);
if (!flightMigrationName) {
  throw new Error("No se encontro la migracion de campos de vuelo en bookings");
}
const flightMigration = readFileSync(
  path.join(MIGRATIONS_DIR, flightMigrationName),
  "utf8",
);

const journalMigrationName = readdirSync(MIGRATIONS_DIR).find((file) =>
  file.endsWith("_create-journal-entries.sql"),
);
if (!journalMigrationName) {
  throw new Error("No se encontro la migracion del diario de viaje");
}
const journalMigration = readFileSync(
  path.join(MIGRATIONS_DIR, journalMigrationName),
  "utf8",
);

const journalPhotosMigrationName = readdirSync(MIGRATIONS_DIR).find((file) =>
  file.endsWith("_create-journal-photos.sql"),
);
if (!journalPhotosMigrationName) {
  throw new Error("No se encontro la migracion de fotos del diario");
}
const journalPhotosMigration = readFileSync(
  path.join(MIGRATIONS_DIR, journalPhotosMigrationName),
  "utf8",
);

const FLIGHT_COLUMNS = ["airline", "flight_number", "origin", "destination"];

// Las FKs sin indice hacen que borrar un viaje escanee la tabla hija entera
// (advisor del backend: missing-fk-index en alerts y budgets). El contrato de
// esta migracion es solo indice: si alguien anade columnas, policies o RLS, el
// test falla y obliga a justificarlo aqui.
const fkIndexMigrationName = readdirSync(MIGRATIONS_DIR).find((file) =>
  file.endsWith("_add-fk-indexes-alerts-budgets.sql"),
);
if (!fkIndexMigrationName) {
  throw new Error("No se encontro la migracion de indices de FK en alerts y budgets");
}
const fkIndexMigration = readFileSync(
  path.join(MIGRATIONS_DIR, fkIndexMigrationName),
  "utf8",
);

// El advisor de InsForge marca las 43 policies de RLS como rls-policy-perf:
// con auth.uid() suelto, la funcion se re-evalua por fila; envuelta en
// (select auth.uid()) se evalua una sola vez. El contrato de esta migracion es
// solo esa reescritura mecanica: mismo propietario, mismos comandos y mismos
// WITH CHECK.
const subqueryMigrationName = readdirSync(MIGRATIONS_DIR).find((file) =>
  file.endsWith("_rewrite-rls-policies-with-subquery.sql"),
);
if (!subqueryMigrationName) {
  throw new Error(
    "No se encontro la migracion de reescritura de policies con subquery",
  );
}
const subqueryMigration = readFileSync(
  path.join(MIGRATIONS_DIR, subqueryMigrationName),
  "utf8",
);

describe("bookings: RLS y politicas de propietario", () => {
  it("tiene RLS habilitada", () => {
    expect(baseSchema).toMatch(
      /alter table public\.bookings enable row level security;/,
    );
  });

  it("esta en el grupo de tablas con politicas de propietario por user_id", () => {
    expect(baseSchema).toMatch(
      /foreach t in array array\[\s*'trips', 'expenses', 'notes', 'tasks', 'bookings',/,
    );
    expect(baseSchema).toMatch(/auth\.uid\(\) = user_id/);
  });

  it("declara las cuatro politicas (select, insert, update, delete)", () => {
    for (const suffix of [
      "_select_own",
      "_insert_own",
      "_update_own",
      "_delete_own",
    ]) {
      expect(baseSchema).toContain(`t || '${suffix}'`);
    }
  });
});

describe("migracion de campos de vuelo", () => {
  it("anade las columnas de vuelo como texto nullable", () => {
    for (const column of FLIGHT_COLUMNS) {
      expect(flightMigration).toMatch(
        new RegExp(`add column if not exists ${column} text`),
      );
    }
  });

  it("no crea ni borra politicas: las de bookings ya cubren las columnas nuevas", () => {
    expect(flightMigration).not.toMatch(/create policy/i);
    expect(flightMigration).not.toMatch(/drop policy/i);
    expect(flightMigration).not.toMatch(/enable row level security/i);
  });
});

// El diario de viaje (#46) anade una tabla nueva, y una tabla con user_id sin RLS
// seria una fuga silenciosa. La guardia fija el contrato de propietario y, ademas,
// demuestra su comportamiento para dos usuarios: el predicado de lectura sale de la
// propia migracion, no de este test.
describe("diario de viaje: RLS y aislamiento de dos usuarios", () => {
  function policySql(name: string): string {
    const match = journalMigration.match(
      new RegExp(`create policy ${name}[\\s\\S]*?;`),
    );
    if (!match) {
      throw new Error(`No se encontro la politica ${name} en la migracion`);
    }
    return match[0];
  }

  // Columna de propietario que el backend aplica en la lectura, leida del SQL.
  function ownerColumnOfSelectPolicy(): string {
    const match = policySql("journal_entries_select_own").match(
      /using \(auth\.uid\(\) = (\w+)\)/,
    );
    if (!match) {
      throw new Error("La politica de lectura no usa un predicado de propietario");
    }
    return match[1];
  }

  it("crea la tabla de forma idempotente y con RLS habilitada", () => {
    expect(journalMigration).toMatch(
      /create table if not exists public\.journal_entries/,
    );
    expect(journalMigration).toMatch(
      /alter table public\.journal_entries enable row level security;/,
    );
  });

  it("declara las cuatro politicas de propietario (select, insert, update, delete)", () => {
    for (const suffix of [
      "_select_own",
      "_insert_own",
      "_update_own",
      "_delete_own",
    ]) {
      expect(journalMigration).toContain(`create policy journal_entries${suffix}`);
    }
  });

  it("insert y update llevan with check para que nadie cree filas ajenas", () => {
    expect(policySql("journal_entries_insert_own")).toMatch(
      /with check \(auth\.uid\(\) = user_id\)/,
    );
    expect(policySql("journal_entries_update_own")).toMatch(
      /with check \(auth\.uid\(\) = user_id\)/,
    );
  });

  it("concede los privilegios de tabla que la migracion base no cubre", () => {
    expect(journalMigration).toMatch(
      /grant select, insert, update, delete on public\.journal_entries to anon, authenticated;/,
    );
  });

  it("la lectura aisla a dos usuarios: cada uno solo ve sus propias filas", () => {
    const ownerColumn = ownerColumnOfSelectPolicy();
    const rows: Record<string, string>[] = [
      { id: "a1", user_id: "user-a", content: "el viaje de a" },
      { id: "a2", user_id: "user-a", content: "otra entrada de a" },
      { id: "b1", user_id: "user-b", content: "el viaje de b" },
    ];

    const visibleTo = (viewerId: string) =>
      rows.filter((row) => row[ownerColumn] === viewerId).map((row) => row.id);

    expect(visibleTo("user-a")).toEqual(["a1", "a2"]);
    expect(visibleTo("user-b")).toEqual(["b1"]);
    // La clave del aislamiento: b no ve nada de a.
    expect(visibleTo("user-b")).not.toContain("a1");
  });
});

// Las fotos del diario (#46, hito 2) son otra tabla nueva con user_id. Mismo
// contrato: RLS habilitada, cuatro politicas de propietario y una demostracion
// conductual de que un usuario no ve las filas de otro.
describe("fotos del diario: RLS y aislamiento de dos usuarios", () => {
  function policySql(name: string): string {
    const match = journalPhotosMigration.match(
      new RegExp(`create policy ${name}[\\s\\S]*?;`),
    );
    if (!match) {
      throw new Error(`No se encontro la politica ${name} en la migracion`);
    }
    return match[0];
  }

  function ownerColumnOfSelectPolicy(): string {
    const match = policySql("journal_photos_select_own").match(
      /using \(auth\.uid\(\) = (\w+)\)/,
    );
    if (!match) {
      throw new Error("La politica de lectura no usa un predicado de propietario");
    }
    return match[1];
  }

  it("crea la tabla de forma idempotente y con RLS habilitada", () => {
    expect(journalPhotosMigration).toMatch(
      /create table if not exists public\.journal_photos/,
    );
    expect(journalPhotosMigration).toMatch(
      /alter table public\.journal_photos enable row level security;/,
    );
  });

  it("declara las cuatro politicas de propietario (select, insert, update, delete)", () => {
    for (const suffix of [
      "_select_own",
      "_insert_own",
      "_update_own",
      "_delete_own",
    ]) {
      expect(journalPhotosMigration).toContain(
        `create policy journal_photos${suffix}`,
      );
    }
  });

  it("insert y update llevan with check para que nadie cree filas ajenas", () => {
    expect(policySql("journal_photos_insert_own")).toMatch(
      /with check \(auth\.uid\(\) = user_id\)/,
    );
    expect(policySql("journal_photos_update_own")).toMatch(
      /with check \(auth\.uid\(\) = user_id\)/,
    );
  });

  it("concede los privilegios de tabla que la migracion base no cubre", () => {
    expect(journalPhotosMigration).toMatch(
      /grant select, insert, update, delete on public\.journal_photos to anon, authenticated;/,
    );
  });

  it("la lectura aisla a dos usuarios: cada uno solo ve sus propias filas", () => {
    const ownerColumn = ownerColumnOfSelectPolicy();
    const rows: Record<string, string>[] = [
      { id: "pa1", user_id: "user-a", key: "a/1.jpg" },
      { id: "pb1", user_id: "user-b", key: "b/1.jpg" },
    ];

    const visibleTo = (viewerId: string) =>
      rows.filter((row) => row[ownerColumn] === viewerId).map((row) => row.id);

    expect(visibleTo("user-a")).toEqual(["pa1"]);
    expect(visibleTo("user-b")).toEqual(["pb1"]);
    expect(visibleTo("user-b")).not.toContain("pa1");
  });
});

// El advisor del backend marca missing-fk-index en alerts.trip_id y
// budgets.trip_id: sin indice, borrar o actualizar un viaje escanea la tabla
// hija entera. Con pocas filas no se nota, pero es el tipo de deuda que se paga
// justo cuando la app empieza a usarse.
describe("indices de las FKs hacia trips", () => {
  const INDEXES = [
    { table: "alerts", index: "idx_alerts_trip_id" },
    { table: "budgets", index: "idx_budgets_trip_id" },
  ];

  it("crea el indice de trip_id en cada tabla hija, de forma idempotente", () => {
    for (const { table, index } of INDEXES) {
      expect(fkIndexMigration).toMatch(
        new RegExp(
          `create index if not exists ${index} on public\\.${table} \\(trip_id\\);`,
        ),
      );
    }
  });

  // El indice tiene que cubrir tambien las filas sin viaje (trip_id nulo): son
  // las alerts y budgets globales, y las que deja huerfanas un borrado. Un
  // indice parcial sobre trip_id is not null no las cubre.
  it("el indice de budgets cubre tambien las filas sin viaje", () => {
    expect(fkIndexMigration).toMatch(
      /create index if not exists idx_budgets_trip_id on public\.budgets \(trip_id\);/,
    );
    expect(fkIndexMigration).not.toMatch(/where trip_id is not null/i);
  });

  it("cubre las dos FKs que el advisor reporta, y solo esas", () => {
    const indexed = [...fkIndexMigration.matchAll(/on public\.(\w+) \(/g)].map(
      (match) => match[1],
    );
    expect(indexed.sort()).toEqual(["alerts", "budgets"]);
  });

  // La migracion es solo indice: si alguien la cuelga de columnas, policies o
  // RLS, el alcance del cambio deja de ser el que se reviso.
  it("no toca columnas, politicas, RLS ni permisos", () => {
    expect(fkIndexMigration).not.toMatch(/alter table/i);
    expect(fkIndexMigration).not.toMatch(/create policy/i);
    expect(fkIndexMigration).not.toMatch(/drop policy/i);
    expect(fkIndexMigration).not.toMatch(/enable row level security/i);
    expect(fkIndexMigration).not.toMatch(/\bgrant\b/i);
    expect(fkIndexMigration).not.toMatch(/\bbegin\b|\bcommit\b|\brollback\b/i);
  });
});

// Deuda rls-policy-perf del advisor (#65): las 43 policies de la base siguen
// llamando a auth.uid() por fila. La migracion la envuelve en (select auth.uid())
// sin cambiar a quien ve que. El test fija el alcance (que tablas, que comandos)
// y, ademas, demuestra el aislamiento de dos usuarios leyendo el propietario del
// propio SQL, no de este fichero.
describe("reescritura de policies RLS con subquery", () => {
  // El SQL sin comentarios: los conteos no deben depender del texto explicativo.
  const subquerySql = subqueryMigration.replace(/--[^\n]*/g, "");

  function occurrences(text: string, pattern: RegExp): number {
    return (text.match(pattern) || []).length;
  }

  // Las tablas se recorren con `foreach t in array array[...]`, asi que el
  // archivo lista las tablas y los comandos una sola vez; el numero de policies
  // es tablas * comandos, no las apariciones del texto.
  const arrayLiterals = [
    ...subquerySql.matchAll(/foreach t in array array\[([\s\S]*?)\]/g),
  ].map((match) => match[1]);

  function tablesOfArrayLiteral(literal: string): string[] {
    return [...literal.matchAll(/'(\w+)'/g)].map((match) => match[1]);
  }

  const userTables = arrayLiterals[0]
    ? tablesOfArrayLiteral(arrayLiterals[0])
    : [];
  const profileTables = arrayLiterals[1]
    ? tablesOfArrayLiteral(arrayLiterals[1])
    : [];

  // Columna de propietario que el backend aplica en cada lectura, leida del SQL.
  function ownerColumnsOfSelectPolicies(): string[] {
    return [
      ...subquerySql.matchAll(
        /for select using \(\(select auth\.uid\(\)\) = (\w+)\)/g,
      ),
    ].map((match) => match[1]);
  }

  it("lista en el bucle las 10 tablas con user_id y profiles aparte", () => {
    expect(userTables.sort()).toEqual(
      [
        "alerts",
        "bookings",
        "budgets",
        "expenses",
        "itinerary_activities",
        "journal_entries",
        "journal_photos",
        "notes",
        "tasks",
        "trips",
      ].sort(),
    );
    expect(profileTables).toEqual(["profiles"]);
  });

  it("cubre las 43 policies: cuatro por tabla con user_id y tres en profiles", () => {
    const totalPolicies = userTables.length * 4 + profileTables.length * 3;
    expect(totalPolicies).toBe(43);
    // El bloque de user_id declara los cuatro comandos y el de profiles tres
    // (profiles no tiene politica de delete).
    expect(occurrences(subquerySql, /for select using/g)).toBe(2);
    expect(occurrences(subquerySql, /for insert with check/g)).toBe(2);
    expect(occurrences(subquerySql, /for update using/g)).toBe(2);
    expect(occurrences(subquerySql, /for delete using/g)).toBe(1);
  });

  it("envuelve auth.uid() en un subquery, sin dejar llamadas sueltas", () => {
    const calls = occurrences(subquerySql, /auth\.uid\(\)/g);
    const wrapped = occurrences(subquerySql, /\(select auth\.uid\(\)\)/g);
    // 5 plantillas en el bloque user_id (select + insert + update x2 + delete) y
    // 4 en profiles, todas envueltas.
    expect(calls).toBe(9);
    expect(wrapped).toBe(9);
  });

  it("mantiene el propietario: user_id en las tablas de usuario e id en profiles", () => {
    expect(ownerColumnsOfSelectPolicies()).toEqual(["user_id", "id"]);
  });

  it("cada insert y cada update conservan su with check", () => {
    expect(
      occurrences(subquerySql, /with check \(\(select auth\.uid\(\)\)/g),
    ).toBe(4);
  });

  it("es idempotente: un drop policy if exists por cada create policy", () => {
    expect(occurrences(subquerySql, /drop policy if exists %I/g)).toBe(7);
    expect(occurrences(subquerySql, /create policy %I/g)).toBe(7);
  });

  it("no cambia la semantica: no toca tablas, permisos, RLS ni storage", () => {
    expect(subquerySql).not.toMatch(/alter table/i);
    expect(subquerySql).not.toMatch(/create table/i);
    expect(subquerySql).not.toMatch(/create index/i);
    expect(subquerySql).not.toMatch(/enable row level security/i);
    expect(subquerySql).not.toMatch(/\bgrant\b/i);
    expect(subquerySql).not.toMatch(/storage\.objects/i);
  });

  it("la lectura aisla a dos usuarios: cada uno solo ve sus propias filas", () => {
    const ownerColumn = ownerColumnsOfSelectPolicies().find(
      (column) => column === "user_id",
    );
    expect(ownerColumn).toBe("user_id");

    const rows: Record<string, string>[] = [
      { id: "a1", user_id: "user-a" },
      { id: "a2", user_id: "user-a" },
      { id: "b1", user_id: "user-b" },
    ];

    const visibleTo = (viewerId: string) =>
      rows
        .filter((row) => row[ownerColumn!] === viewerId)
        .map((row) => row.id);

    expect(visibleTo("user-a")).toEqual(["a1", "a2"]);
    expect(visibleTo("user-b")).toEqual(["b1"]);
    // La clave del aislamiento: b no ve nada de a.
    expect(visibleTo("user-b")).not.toContain("a1");
  });
});
