import fs from "node:fs/promises"
import { createHash, randomBytes } from "node:crypto"
import path from "node:path"
import { commitAll } from "./git"

/**
 * PRD §3.4. Every file operation goes through this interface so a GitHub
 * Contents API implementation drops in for M5 (mobile) without touching
 * anything above it.
 */
export interface VaultStore {
  list(): Promise<string[]>
  read(p: string): Promise<{ content: string; hash: string }>
  write(p: string, content: string, expectedHash?: string): Promise<void>
  delete(p: string): Promise<void>
  commit(message: string, push: boolean): Promise<string>
  exists(p: string): Promise<boolean>
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16)
}

export class VaultConflictError extends Error {
  readonly path: string
  constructor(p: string) {
    super(
      `${p} changed on disk since it was read. Another writer (Obsidian, Drive sync) got there first; re-read and retry.`,
    )
    this.path = p
    this.name = "VaultConflictError"
  }
}

export class ReadOnlyVaultError extends Error {
  constructor() {
    super("This instance has no vault configured (BRAIN_PATH is unset). Writes are refused.")
    this.name = "ReadOnlyVaultError"
  }
}

/** Mirrors Quartz's ignorePatterns so the app's listing and the site agree. */
const IGNORED_DIRS = new Set([".obsidian", ".claude", "Templates", "templates", "private", "node_modules", ".git"])
const IGNORED_FILES = new Set(["CLAUDE.md", ".DS_Store"])

export function isIgnored(relPath: string): boolean {
  const parts = relPath.split("/")
  if (parts.some((p) => IGNORED_DIRS.has(p))) return true
  const base = parts[parts.length - 1]
  if (IGNORED_FILES.has(base)) return true
  return false
}

export class FsVaultStore implements VaultStore {
  private readonly root: string
  private readonly repo: string
  private readonly writable: boolean

  constructor(root: string, repo: string, writable: boolean) {
    this.root = root
    this.repo = repo
    this.writable = writable
  }

  private abs(p: string): string {
    const resolved = path.resolve(this.root, p)
    // Never let a wikilink target or a proposal folder escape the vault.
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new Error(`Refusing to touch a path outside the vault: ${p}`)
    }
    return resolved
  }

  async list(): Promise<string[]> {
    const out: string[] = []
    const walk = async (dir: string, prefix: string) => {
      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name
        if (isIgnored(rel)) continue
        if (e.isDirectory()) await walk(path.join(dir, e.name), rel)
        else if (e.name.endsWith(".md")) out.push(rel)
      }
    }
    await walk(this.root, "")
    return out.sort()
  }

  /** Includes ignored paths — needed to read Templates/ and CLAUDE.md for the prompt. */
  async readRaw(p: string): Promise<string> {
    return fs.readFile(this.abs(p), "utf8")
  }

  async read(p: string): Promise<{ content: string; hash: string }> {
    const content = await fs.readFile(this.abs(p), "utf8")
    return { content, hash: hashContent(content) }
  }

  async exists(p: string): Promise<boolean> {
    try {
      await fs.access(this.abs(p))
      return true
    } catch {
      return false
    }
  }

  /**
   * Invariant 9: assume concurrent writers. Read-before-write with a hash
   * compare, then write to a temp file *in the same directory* and rename().
   * A partial write on Google Drive is a corrupted note, and rename is the only
   * operation Drive treats atomically.
   */
  async write(p: string, content: string, expectedHash?: string): Promise<void> {
    if (!this.writable) throw new ReadOnlyVaultError()
    const target = this.abs(p)
    const dir = path.dirname(target)
    await fs.mkdir(dir, { recursive: true })

    if (expectedHash !== undefined) {
      let current: string | null = null
      try {
        current = await fs.readFile(target, "utf8")
      } catch {
        current = null
      }
      const currentHash = current === null ? "" : hashContent(current)
      if (currentHash !== expectedHash) throw new VaultConflictError(p)
    }

    const tmp = path.join(dir, `.marginalia-${randomBytes(6).toString("hex")}.tmp`)
    try {
      await fs.writeFile(tmp, content, "utf8")
      await fs.rename(tmp, target)
    } catch (e) {
      await fs.rm(tmp, { force: true })
      throw e
    }
  }

  async delete(p: string): Promise<void> {
    if (!this.writable) throw new ReadOnlyVaultError()
    await fs.rm(this.abs(p), { force: true })
  }

  async commit(message: string, push: boolean): Promise<string> {
    if (!this.writable) throw new ReadOnlyVaultError()
    const { sha } = await commitAll(this.repo, message, push)
    return sha
  }
}
