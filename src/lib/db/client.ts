import postgres from "postgres"
import { getConfig } from "../config"

/**
 * Lazy, cached on globalThis. A module-level postgres(url) would throw at import
 * time with no DATABASE_URL and take the whole no-database mode down with it;
 * caching on globalThis stops dev-mode module reloads from exhausting the pool.
 */

type Sql = ReturnType<typeof postgres>

const g = globalThis as unknown as { __marginaliaSql?: Sql }

export function db(): Sql {
  const cfg = getConfig()
  if (!cfg.hasDatabase) {
    throw new NoDatabaseError()
  }
  if (!g.__marginaliaSql) {
    const url = process.env.DATABASE_URL!
    g.__marginaliaSql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      // Supabase's pooler terminates prepared statements; disable them so the
      // same connection string works locally and against Supabase unchanged.
      prepare: false,
      ssl: /supabase|amazonaws|neon|render/.test(url) ? "require" : undefined,
    })
  }
  return g.__marginaliaSql
}

export class NoDatabaseError extends Error {
  constructor() {
    super(
      "No DATABASE_URL is configured. This instance serves the demo vault read-only; " +
        "sources, highlights and proposals need a Postgres (or Supabase) database.",
    )
    this.name = "NoDatabaseError"
  }
}

export function hasDatabase(): boolean {
  return getConfig().hasDatabase
}

/** Short, sortable, URL-safe ids in the shape the PRD uses (`cap_01J9K2M4XQ`). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export function newId(prefix: string): string {
  const time = Date.now()
  let ts = ""
  let t = time
  for (let i = 0; i < 8; i++) {
    ts = ALPHABET[t % 32] + ts
    t = Math.floor(t / 32)
  }
  let rand = ""
  for (let i = 0; i < 6; i++) rand += ALPHABET[Math.floor(Math.random() * 32)]
  return `${prefix}_${ts}${rand}`
}
