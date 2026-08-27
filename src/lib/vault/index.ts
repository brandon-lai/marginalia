import { getConfig } from "../config"
import { FsVaultStore, isIgnored } from "./store"
import { parseNote, type Note } from "./parse"
import { basenameOf, resolveTarget } from "./wikilink"
import { batchGitDates } from "./git"
import path from "node:path"

export interface VaultIndex {
  notes: Map<string, Note>
  byBasename: Map<string, string>
  /** Basenames that appear more than once — invariant 1 is broken if non-empty. */
  collisions: string[]
  /** Unresolved wikilink targets: the write-next queue (invariant 8). */
  unresolvedTargets: Map<string, { from: string; count: number }[]>
  folders: string[]
  tagCounts: Map<string, number>
  builtAt: number
  hasVault: boolean
  root: string
}

let cache: { index: VaultIndex; key: string } | null = null

export function getStore(): FsVaultStore {
  const cfg = getConfig()
  return new FsVaultStore(path.resolve(cfg.brainPath), path.resolve(cfg.brainRepo), cfg.canWrite)
}

/** Drop the cached index. Called after any write, and by the file watcher. */
export function invalidateIndex() {
  cache = null
}

export async function getIndex(): Promise<VaultIndex> {
  const cfg = getConfig()
  const key = cfg.brainPath
  if (cache && cache.key === key) return cache.index
  const index = await buildIndex()
  cache = { index, key }
  return index
}

export async function buildIndex(): Promise<VaultIndex> {
  const cfg = getConfig()
  const store = getStore()
  const paths = await store.list()

  const notes = new Map<string, Note>()
  const byBasename = new Map<string, string>()
  const collisionSet = new Set<string>()

  for (const p of paths) {
    if (isIgnored(p)) continue
    let raw: string
    try {
      raw = await store.readRaw(p)
    } catch {
      continue
    }
    const parsed = parseNote(p, raw)
    const note: Note = { ...parsed, incoming: [], unresolved: [] }
    notes.set(p, note)

    const base = p.split("/").pop()!.replace(/\.md$/, "")
    if (byBasename.has(base)) {
      // Invariant 1. Log loudly — markdownLinkResolution: "shortest" makes
      // every link to this basename ambiguous the moment a collision exists.
      collisionSet.add(base)
      console.warn(
        `[marginalia] BASENAME COLLISION: "${base}" is both ${byBasename.get(base)} and ${p}. ` +
          `Wikilinks to it are ambiguous in Quartz and Obsidian.`,
      )
    } else {
      byBasename.set(base, p)
    }
  }

  // Backlinks by inversion, and the unresolved queue.
  const unresolvedTargets = new Map<string, { from: string; count: number }[]>()
  for (const note of notes.values()) {
    if (note.type === "template") continue
    const seenUnresolved = new Map<string, number>()
    for (const link of note.outgoing) {
      if (link.isEmbed) continue
      const targetPath = resolveTarget(link.target, byBasename)
      if (targetPath) {
        const target = notes.get(targetPath)
        if (target && targetPath !== note.path) {
          target.incoming.push({ from: note.path, relation: link.relation, alias: link.alias })
        }
      } else {
        const bare = basenameOf(link.target)
        seenUnresolved.set(bare, (seenUnresolved.get(bare) ?? 0) + 1)
      }
    }
    for (const [target, count] of seenUnresolved) {
      note.unresolved.push(target)
      const list = unresolvedTargets.get(target) ?? []
      list.push({ from: note.path, count })
      unresolvedTargets.set(target, list)
    }
  }

  // Dates from git, one batched pass (invariant 5).
  try {
    const vaultPrefix = path.relative(path.resolve(cfg.brainRepo), path.resolve(cfg.brainPath)) || "."
    const dates = await batchGitDates(path.resolve(cfg.brainRepo), vaultPrefix)
    for (const [rel, d] of dates) {
      const note = notes.get(rel)
      if (note) {
        note.createdAt = d.createdAt
        note.updatedAt = d.updatedAt
      }
    }
  } catch (e) {
    console.warn("[marginalia] git dates unavailable, falling back to none:", e)
  }

  const folders = [...new Set([...notes.values()].map((n) => n.folder).filter(Boolean))].sort()
  const tagCounts = new Map<string, number>()
  for (const n of notes.values()) for (const t of n.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)

  return {
    notes,
    byBasename,
    collisions: [...collisionSet],
    unresolvedTargets,
    folders,
    tagCounts,
    builtAt: Date.now(),
    hasVault: cfg.hasVault,
    root: cfg.brainPath,
  }
}

/** Subject folders only — excludes Homebase, Inbox, Attachments and the root. */
export function subjectFolders(index: VaultIndex): { folder: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const n of index.notes.values()) {
    if (n.type !== "concept" && n.type !== "book") continue
    if (!n.folder) continue
    counts.set(n.folder, (counts.get(n.folder) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder))
}

/**
 * The MOC for a subject.
 *
 * The naming convention is Homebase/<Subject> MOC.md, but it is a convention
 * and not a rule: the vault's Computer Science folder is served by "CS MOC".
 * Matching on the name alone reported "no MOC yet" for the single largest
 * subject in the vault, so the last resort is to ask which MOC actually links
 * into the folder — a MOC is defined by what it indexes, not by what it is
 * called.
 */
export function mocFor(index: VaultIndex, folder: string): Note | undefined {
  const direct = index.notes.get(`Homebase/${folder} MOC.md`)
  if (direct) return direct

  const mocs = [...index.notes.values()].filter((n) => n.type === "moc")

  for (const n of mocs) {
    if (n.title.replace(/\s+MOC$/, "").toLowerCase() === folder.toLowerCase()) return n
  }

  // Which MOC's links land in this folder most often?
  let best: { note: Note; hits: number } | undefined
  for (const n of mocs) {
    let hits = 0
    for (const link of n.outgoing) {
      if (link.isEmbed) continue
      const target = index.byBasename.get(link.target)
      if (target && index.notes.get(target)?.folder === folder) hits++
    }
    if (hits >= 2 && (!best || hits > best.hits)) best = { note: n, hits }
  }
  return best?.note
}
