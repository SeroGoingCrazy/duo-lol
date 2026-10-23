// The app database. Production sets DATABASE_URL (Postgres, ADR-0004); without it, local runs and tests use
// PGlite, an in-process Postgres stored in APP_DB_DIR, so the same schema and migrations work without a server.
import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function open(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    // App timestamps are stored without a zone and Drizzle writes JS dates in UTC.
    // Every pooled connection must also evaluate defaultNow() in UTC.
    const db = drizzle(postgres(process.env.DATABASE_URL, { connection: { TimeZone: "UTC" } }), { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.APP_DB_DIR ?? path.join(process.cwd(), ".data", "app");
  // PGlite creates its data directory, but not missing parent directories.
  await mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  await client.exec("SET TIME ZONE 'UTC'");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

// One connection per server process, migrated on first use.
const g = globalThis as { appDb?: Promise<Db> };
export function getDb(): Promise<Db> {
  g.appDb ??= open();
  return g.appDb;
}

export { schema };
