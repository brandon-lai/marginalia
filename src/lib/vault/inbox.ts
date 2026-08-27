import matter from "gray-matter"
import { FsVaultStore, VaultConflictError } from "./store"
import type { CapturePayload } from "../types"

/**
 * Captures are written to brain/Inbox/ immediately, before anything else
 * happens (PRD §4.1). If extraction fails, if the database is down, if the app
 * is never opened again, the material is still in the vault and /process-inbox
 * still works on it. This is the fallback that makes the rest safe to build.
 *
 * One file per source, appended to. A second highlight from the same URL finds
 * the existing file by its source_url frontmatter and appends, so one article
 * produces one working document rather than eight inbox files.
 */

export interface InboxWriteResult {
  path: string
  created: boolean
  anchor: string
}

/** `Inbox/<YYYY-MM-DD> <slugged title>.md`, truncated to 80 chars total. */
export function inboxFilename(title: string, date: Date, suffix = 0): string {
  const day = date.toISOString().slice(0, 10)
  const cleanTitle = title
    .replace(/[\\/:*?"<>|#\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Untitled"
  const suffixPart = suffix > 0 ? ` ${suffix}` : ""
  const budget = 80 - ".md".length - day.length - 1 - suffixPart.length
  const truncated = cleanTitle.length > budget ? cleanTitle.slice(0, budget).trimEnd() : cleanTitle
  return `Inbox/${day} ${truncated}${suffixPart}.md`
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** "2026-08-26 14:32" in local time, the heading format §4.1 specifies. */
function stampFor(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function blockquote(text: string): string {
  // Wrap at ~72 chars so the file reads well in Obsidian.
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const w of words) {
    if (line && line.length + w.length + 1 > 72) {
      lines.push(line)
      line = w
    } else {
      line = line ? `${line} ${w}` : w
    }
  }
  if (line) lines.push(line)
  return lines.map((l) => `> ${l}`).join("\n")
}

/** Find an existing inbox file for this URL by reading frontmatter. */
export async function findInboxFileForUrl(store: FsVaultStore, url: string): Promise<string | null> {
  const all = await store.list()
  for (const p of all) {
    if (!p.startsWith("Inbox/")) continue
    try {
      const { content } = await store.read(p)
      const fm = matter(content).data as Record<string, unknown>
      if (fm.source_url === url) return p
    } catch {
      /* unreadable file, skip */
    }
  }
  return null
}

function buildNewFile(payload: CapturePayload, captureId: string, when: Date): string {
  const fm = [
    "---",
    "draft: true",
    "brain_capture: true",
    `capture_id: ${captureId}`,
    `source_url: ${payload.url}`,
    `source_title: ${yamlString(payload.title ?? payload.url)}`,
    ...(payload.author ? [`source_author: ${yamlString(payload.author)}`] : []),
    `source_type: ${payload.site && /youtube|vimeo/.test(payload.site) ? "video" : "article"}`,
    `captured_at: ${when.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    "status: open",
    "---",
    "",
    `# ${payload.title ?? payload.url}`,
    "",
    "## Highlights",
    "",
  ]
  return fm.join("\n")
}

/**
 * `draft: true` is deliberate. brain/Inbox/ is not in Quartz's ignorePatterns,
 * so inbox files would otherwise publish to the live site. The RemoveDrafts
 * filter already exists in the pipeline and nothing uses it, so this keeps raw
 * captures off the public site with zero config change (PRD §4.1).
 */
function yamlString(s: string): string {
  const needsQuotes = /[:#\-{}\[\]&*!|>'"%@`]|^\s|\s$/.test(s)
  return needsQuotes ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s
}

/** The `## My thinking` free-form section always sits last. */
const THINKING_HEADING = "## My thinking"

function insertHighlightBlock(existing: string, block: string): string {
  const idx = existing.indexOf(`\n${THINKING_HEADING}`)
  if (idx === -1) {
    return `${existing.replace(/\s*$/, "")}\n\n${block}\n`
  }
  const before = existing.slice(0, idx)
  const after = existing.slice(idx)
  return `${before.replace(/\s*$/, "")}\n\n${block}\n${after}`
}

/**
 * Append a capture to its source's inbox file, creating the file if this is the
 * first highlight for that URL. Retries once on a concurrent-write conflict —
 * Obsidian may have saved the same file between our read and our write, and
 * neither write should be lost (PRD §11).
 */
export async function appendCapture(
  store: FsVaultStore,
  payload: CapturePayload,
  captureId: string,
): Promise<InboxWriteResult> {
  const when = payload.captured_at ? new Date(payload.captured_at) : new Date()
  const stamp = stampFor(when)

  for (let attempt = 0; attempt < 3; attempt++) {
    const existingPath = await findInboxFileForUrl(store, payload.url)

    let path: string
    let current: string
    let hash: string | undefined
    let created: boolean

    if (existingPath) {
      const read = await store.read(existingPath)
      path = existingPath
      current = read.content
      hash = read.hash
      created = false
    } else {
      path = await uniqueInboxPath(store, payload.title ?? payload.url, when)
      current = buildNewFile(payload, captureId, when)
      hash = "" // must not exist yet
      created = true
    }

    const parts: string[] = [`### ${stamp}`, ""]
    if (payload.selection?.trim()) {
      // Highlight text stays a blockquote: structurally marked as not
      // Brandon's words, which is what §8 depends on.
      parts.push(blockquote(payload.selection.trim()), "")
    }
    if (payload.note?.trim()) {
      parts.push(`**My note:** ${payload.note.trim()}`, "")
    }
    if (!payload.selection?.trim() && !payload.note?.trim()) {
      parts.push("*Saved with no highlight.*", "")
    }
    const block = parts.join("\n").trimEnd()

    const next = insertHighlightBlock(current, block)

    try {
      await store.write(path, next, hash)
      return { path, created, anchor: stamp }
    } catch (e) {
      if (e instanceof VaultConflictError && attempt < 2) continue // re-read and retry
      throw e
    }
  }
  throw new Error("Could not append the capture after 3 attempts; the inbox file is being written concurrently.")
}

async function uniqueInboxPath(store: FsVaultStore, title: string, when: Date): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = inboxFilename(title, when, i)
    if (!(await store.exists(candidate))) return candidate
  }
  throw new Error("Could not find a free inbox filename")
}

/** Append to the free-form `## My thinking` section. */
export async function appendThinking(store: FsVaultStore, inboxPath: string, text: string): Promise<void> {
  const { content, hash } = await store.read(inboxPath)
  let next: string
  if (content.includes(`\n${THINKING_HEADING}`)) {
    next = `${content.replace(/\s*$/, "")}\n\n${text.trim()}\n`
  } else {
    next = `${content.replace(/\s*$/, "")}\n\n${THINKING_HEADING}\n\n${text.trim()}\n`
  }
  await store.write(inboxPath, next, hash)
}
