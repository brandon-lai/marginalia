/**
 * Applies src/lib/db/schema.sql to DATABASE_URL. Idempotent — every statement
 * is CREATE ... IF NOT EXISTS, so running it against an existing database is
 * safe and is how migrations land.
 *
 * Works against local Postgres and against Supabase unchanged; the connection
 * string is the only difference.
 */
import "./load-env.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n" +
      "  local:    postgres://you@localhost:5432/marginalia\n" +
      "  Supabase: the pooler connection string from Project Settings → Database",
  )
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const schema = readFileSync(path.join(here, "..", "src", "lib", "db", "schema.sql"), "utf8")

const sql = postgres(url, {
  prepare: false,
  ssl: /supabase|amazonaws|neon|render/.test(url) ? "require" : undefined,
  // Every statement is CREATE ... IF NOT EXISTS, so re-running floods the
  // output with "already exists, skipping" notices. Report anything that is
  // not that.
  onnotice: (n) => {
    if (n.code !== "42P07" && n.code !== "42P06" && n.code !== "42710") {
      console.warn(`${n.severity}: ${n.message}`)
    }
  },
})

try {
  await sql.unsafe(schema)
  const tables = await sql`
    select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`
  console.log(`schema applied. tables: ${tables.map((t) => t.table_name).join(", ")}`)

  // pgvector is optional. Supabase has it; a stock local Postgres usually does
  // not. Embeddings are v1.5 (PRD §6.5) and v1 ranks by keyword, so its absence
  // is reported rather than treated as a failure.
  const [vec] = await sql`
    select installed_version from pg_available_extensions where name = 'vector'`
  if (!vec) console.log("pgvector: not available — fine, v1 ranks related notes by keyword.")
  else if (!vec.installed_version) console.log("pgvector: available but not installed (create extension vector).")
  else console.log(`pgvector: installed (${vec.installed_version}).`)
} finally {
  await sql.end()
}
