import fs from "node:fs"
import path from "node:path"

/**
 * Three independent capabilities, each checked at every entry point. The app
 * runs with none of them configured — that is what makes a deployment
 * verifiable before any credential exists (and it is what the public demo is).
 */

export interface AppConfig {
  /** Absolute path to the vault (the `brain/` directory). */
  brainPath: string
  /** Absolute path to the git repo that contains the vault. */
  brainRepo: string
  /** False when serving the bundled demo vault instead of a real one. */
  hasVault: boolean
  hasDatabase: boolean
  hasAnthropic: boolean
  /** Shared secret the Chrome extension presents on /api/capture. */
  captureSecret: string | null
  /** Writes to disk and git are only ever attempted against a real vault. */
  canWrite: boolean
}

/** The demo vault ships in the repo so the app has something to render with nothing configured. */
export const DEMO_VAULT_PATH = path.join(process.cwd(), "demo-vault", "brain")

let cached: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cached) return cached

  const rawBrain = process.env.BRAIN_PATH?.trim()
  const rawRepo = process.env.BRAIN_REPO?.trim()

  let brainPath: string
  let brainRepo: string
  let hasVault: boolean

  if (rawBrain) {
    // PRD §11: "The app refuses to start rather than silently degrading if
    // BRAIN_PATH points somewhere unexpected." An unset BRAIN_PATH is the
    // documented demo mode; a set-but-wrong one is a configuration error and
    // must be loud, because the alternative is writing notes into the void.
    assertLooksLikeVault(rawBrain)
    brainPath = rawBrain
    brainRepo = rawRepo || path.dirname(rawBrain)
    hasVault = true
  } else {
    brainPath = DEMO_VAULT_PATH
    brainRepo = path.dirname(DEMO_VAULT_PATH)
    hasVault = false
  }

  cached = {
    brainPath,
    brainRepo,
    hasVault,
    hasDatabase: Boolean(process.env.DATABASE_URL?.trim()),
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    captureSecret: process.env.CAPTURE_SECRET?.trim() || null,
    canWrite: hasVault,
  }
  return cached
}

/** Exported for tests. Throws with a specific reason rather than a generic failure. */
export function assertLooksLikeVault(p: string): void {
  if (!path.isAbsolute(p)) {
    throw new Error(`BRAIN_PATH must be an absolute path, got: ${p}`)
  }
  let stat: fs.Stats
  try {
    stat = fs.statSync(p)
  } catch {
    throw new Error(`BRAIN_PATH does not exist: ${p}`)
  }
  if (!stat.isDirectory()) {
    throw new Error(`BRAIN_PATH is not a directory: ${p}`)
  }
  // A vault has notes and the Homebase MOC layer. Pointing at, say, the repo
  // root instead of repo/brain would otherwise index 500 files of Quartz source.
  const entries = fs.readdirSync(p)
  const hasMarkdown = entries.some((e) => e.endsWith(".md"))
  const hasHomebase = entries.includes("Homebase")
  if (!hasMarkdown || !hasHomebase) {
    throw new Error(
      `BRAIN_PATH does not look like the brain vault (expected markdown files and a Homebase/ folder): ${p}`,
    )
  }
}

/** Reset between tests. */
export function __resetConfig() {
  cached = null
}
