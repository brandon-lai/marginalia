/**
 * Next.js loads .env.local automatically; a plain node script does not. This
 * gives the scripts the same environment the app sees, so `npm run db:init`
 * and the rebuild use the connection string already configured rather than
 * needing it re-exported by hand.
 */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"

for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file)
  if (!existsSync(p)) continue
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue // real env wins
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
