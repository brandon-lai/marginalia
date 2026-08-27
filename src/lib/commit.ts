import "server-only"
import path from "node:path"
import { getIndex, getStore, invalidateIndex, mocFor } from "./vault/index"
import { applyMocUpdate, mocFromTemplate, type DiffLine } from "./vault/moc"
import { updateRecentlyAdded, existingRecentlyAdded, projectRecentlyAdded, appendSubjectCard, subjectCardHtml, subjectColorRule } from "./vault/indexmd"
import { recentlyAdded } from "./vault/git"
import { slugifyFilePath } from "./vault/slug"
import { getConfig } from "./config"
import { ReadOnlyVaultError } from "./vault/store"
import type { ProposedNote } from "./types"
import fs from "node:fs/promises"

/**
 * Step 3 of §6.6. On accept, run the full protocol side effects in order.
 * Steps 2 through 4 are exactly the tedium that makes the current workflow
 * heavy; automating them behind one button is most of this product's value.
 *
 * Nothing here runs until Accept, and every step is validated first — a
 * proposal that would break an invariant is refused with a reason rather than
 * half-applied.
 */

export interface CommitPlan {
  notePath: string
  mocPath: string | null
  mocDiff: DiffLine[]
  mocWarnings: string[]
  indexDiff: DiffLine[]
  createsSubject: boolean
  createsMoc: boolean
  errors: string[]
}

export interface CommitResult extends CommitPlan {
  written: string[]
  sha: string | null
  pushed: boolean
}

/** Validate a proposal against the invariants. Returns the errors, empty if fine. */
export async function validate(note: ProposedNote): Promise<string[]> {
  const index = await getIndex()
  const errors: string[] = []

  const title = note.title.trim()
  if (!title) errors.push("The note has no title.")
  if (/[\\/:*?"<>|#\[\]]/.test(title)) {
    errors.push(`The title contains a character that cannot appear in a filename: ${title}`)
  }
  if (!note.folder.trim()) errors.push("The note has no folder.")

  // Invariant 1: basenames stay globally unique. Check before every create.
  const existing = index.byBasename.get(title)
  if (note.action === "create" && existing) {
    errors.push(
      `A note named "${title}" already exists at ${existing}. Basenames must be globally unique — ` +
        `markdownLinkResolution: "shortest" makes every [[${title}]] in the vault ambiguous otherwise. ` +
        `Rename this proposal, or change it to an enrich of the existing note.`,
    )
  }

  // Invariant 3: H1 equals the filename stem.
  const h1 = note.markdown.match(/^#\s+(.*)$/m)?.[1]?.trim()
  if (h1 !== title) errors.push(`The H1 ("${h1 ?? "missing"}") does not match the title ("${title}").`)

  // Invariant 4: no frontmatter on permanent notes.
  if (/^---\r?\n/.test(note.markdown)) {
    errors.push("The note body starts with YAML frontmatter. Permanent notes carry none.")
  }

  // Invariant 2: wikilinks are bare basenames.
  for (const link of note.links) {
    if (link.target.includes("/")) {
      errors.push(`Link [[${link.target}]] contains a folder path. Wikilinks are bare basenames.`)
    }
  }
  const pathish = note.markdown.match(/\[\[[^\]]*\/[^\]]*\]\]/g)
  if (pathish) errors.push(`The body contains folder-qualified wikilinks: ${pathish.join(", ")}`)

  return errors
}

/**
 * Work out every file that would change, without touching disk. This is what
 * the review screen renders as the MOC diff, and it is computed by actually
 * running the edit — the diff shown is the diff that will be applied.
 */
export async function plan(note: ProposedNote): Promise<CommitPlan> {
  const index = await getIndex()
  const store = getStore()
  const errors = await validate(note)

  const notePath = `${note.folder}/${note.title}.md`
  const moc = mocFor(index, note.folder)
  const createsSubject = !index.folders.includes(note.folder)
  const createsMoc = !moc

  let mocDiff: DiffLine[] = []
  let mocWarnings: string[] = []
  let mocPath: string | null = null

  if (note.mocUpdate || moc || createsMoc) {
    const targetMocPath = note.mocUpdate?.file ?? moc?.path ?? `Homebase/${note.folder} MOC.md`
    mocPath = targetMocPath
    const addLink = note.mocUpdate?.addLink ?? `[[${note.title}]]`
    const section = note.mocUpdate?.section ?? "Core Concepts"

    let mocContent: string
    if (await store.exists(targetMocPath)) {
      mocContent = (await store.read(targetMocPath)).content
    } else {
      const template = await safeRead(store, "Templates/MOC.md")
      mocContent = mocFromTemplate(template || FALLBACK_MOC, note.folder, note.tags[0] ?? "")
      mocWarnings.push(`${targetMocPath} does not exist yet and will be created from Templates/MOC.md.`)
    }

    const result = applyMocUpdate(mocContent, {
      section,
      addLink,
      removeTodo: note.mocUpdate?.removeTodo,
    })
    mocDiff = result.diff
    mocWarnings = [...mocWarnings, ...result.warnings]
  }

  // index.md's Recently Added, computed the way the protocol's git one-liner does.
  const cfg = getConfig()
  let indexDiff: DiffLine[] = []
  try {
    const indexRaw = await safeRead(store, "index.md")
    if (indexRaw) {
      const projected = await projectedRecent(note.title, indexRaw)
      indexDiff = updateRecentlyAdded(indexRaw, projected).diff
    }
  } catch {
    /* no git, no Recently Added update */
  }

  return { notePath, mocPath, mocDiff, mocWarnings, indexDiff, createsSubject, createsMoc, errors }
}

/**
 * The six most recently added notes as they will read after this note lands:
 * the incoming note first, then git's answer, then whatever index.md already
 * listed. Never fewer entries than are there now.
 */
async function projectedRecent(title: string, indexRaw: string): Promise<{ title: string; date: string }[]> {
  const cfg = getConfig()
  let fromGit: { title: string; date: string }[] = []
  try {
    const vaultPrefix = path.relative(path.resolve(cfg.brainRepo), path.resolve(cfg.brainPath)) || "."
    fromGit = await recentlyAdded(path.resolve(cfg.brainRepo), vaultPrefix, 6)
  } catch {
    fromGit = []
  }
  return projectRecentlyAdded(
    fromGit,
    existingRecentlyAdded(indexRaw),
    { title, date: todayFormatted() },
    6,
  )
}

const FALLBACK_MOC = [
  "# {{Subject}} MOC", "", "#moc #tag", "",
  "*Entry point for everything in this subject. Navigate from here.*", "",
  "## Core Concepts", "", "## Topics To Explore",
  "*Unwritten notes — placeholders and future captures.*", "",
].join("\n")

export interface CommitOptions {
  push: boolean
  /** Description for the index.md subject card, when a new subject is created. */
  subjectDescription?: string
  subjectColor?: string
}

/**
 * Apply the accepted note. Order matters and is the protocol's, not ours.
 * Every write is atomic and hash-checked; the vault is left valid at every step,
 * so killing the app mid-commit loses at most the git commit, never a file.
 */
export async function commitNote(
  note: ProposedNote,
  opts: CommitOptions,
): Promise<CommitResult> {
  const cfg = getConfig()
  if (!cfg.canWrite) throw new ReadOnlyVaultError()

  const p = await plan(note)
  if (p.errors.length) {
    throw new Error(`Refusing to write: ${p.errors.join(" ")}`)
  }

  const store = getStore()
  const written: string[] = []

  // 1. Write brain/<Folder>/<Title>.md, creating the folder if new.
  //    expectedHash "" asserts the file does not exist yet.
  const body = ensureTrailingNewline(note.markdown)
  await store.write(p.notePath, body, note.action === "create" ? "" : undefined)
  written.push(p.notePath)

  // 2. Update the subject MOC: insert the live link, remove the matching todo.
  if (p.mocPath) {
    let mocContent: string
    let hash: string | undefined
    if (await store.exists(p.mocPath)) {
      const read = await store.read(p.mocPath)
      mocContent = read.content
      hash = read.hash
    } else {
      // 3a. New subject: create the MOC from Templates/MOC.md.
      const template = await safeRead(store, "Templates/MOC.md")
      mocContent = mocFromTemplate(template || FALLBACK_MOC, note.folder, note.tags[0] ?? "")
      hash = ""
    }
    const updated = applyMocUpdate(mocContent, {
      section: note.mocUpdate?.section ?? "Core Concepts",
      addLink: note.mocUpdate?.addLink ?? `[[${note.title}]]`,
      removeTodo: note.mocUpdate?.removeTodo,
    })
    await store.write(p.mocPath, ensureTrailingNewline(updated.content), hash)
    written.push(p.mocPath)
  }

  // 3b. New subject: append a card to index.md's .subject-grid, and a
  //     border-color rule to quartz/styles/custom.scss.
  const indexRead = (await store.exists("index.md")) ? await store.read("index.md") : null
  let indexContent = indexRead?.content ?? null

  if (p.createsSubject && indexContent && p.mocPath) {
    const card = subjectCardHtml(
      note.folder,
      slugifyFilePath(p.mocPath),
      opts.subjectDescription ?? `Notes on ${note.folder}.`,
    )
    const res = appendSubjectCard(indexContent, card)
    if (res.ok) indexContent = res.content
    await appendScssRule(cfg.brainRepo, note.folder, opts.subjectColor ?? "#7b97aa")
  }

  // 4. Rewrite the "Recently Added" block from git.
  if (indexContent) {
    try {
      indexContent = updateRecentlyAdded(indexContent, await projectedRecent(note.title, indexContent)).content
    } catch {
      /* leave Recently Added alone if git is unavailable */
    }
    await store.write("index.md", ensureTrailingNewline(indexContent), indexRead?.hash)
    written.push("index.md")
  }

  invalidateIndex()

  // 6. git add . && git commit && git push. Plain push, never `npx quartz sync`.
  let sha: string | null = null
  let pushed = false
  try {
    sha = await store.commit(`Add ${note.title} via marginalia`, opts.push)
    pushed = opts.push
  } catch (e) {
    // The files are written and valid. A failed commit is recoverable by hand
    // and must not be reported as a failed write.
    console.error("[marginalia] files written but git failed:", e)
  }

  return { ...p, written, sha, pushed }
}

/** Step 5: mark the inbox file consumed; delete only when everything in it is used. */
export async function reconcileInbox(
  inboxPath: string,
  usedHighlightAnchors: string[],
  allConsumed: boolean,
): Promise<"deleted" | "updated" | "missing"> {
  const store = getStore()
  if (!(await store.exists(inboxPath))) return "missing"

  if (allConsumed) {
    await store.delete(inboxPath)
    return "deleted"
  }

  const { content, hash } = await store.read(inboxPath)
  let next = content.replace(/^status: open$/m, "status: processing")
  for (const anchor of usedHighlightAnchors) {
    next = next.replace(new RegExp(`^### ${escapeRe(anchor)}$`, "m"), `### ${anchor} ✅ consumed`)
  }
  await store.write(inboxPath, next, hash)
  return "updated"
}

async function appendScssRule(repo: string, subject: string, color: string): Promise<void> {
  const scss = path.join(repo, "quartz", "styles", "custom.scss")
  try {
    const current = await fs.readFile(scss, "utf8")
    const cls = subject.toLowerCase().replace(/\s+/g, "-")
    if (current.includes(`.subject-card.${cls}`)) return
    await fs.appendFile(scss, subjectColorRule(subject, color), "utf8")
  } catch {
    /* the Quartz fork may not be there; the note is still valid without it */
  }
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n"
}

function todayFormatted(): string {
  const d = new Date()
  return `${d.toLocaleString("en-US", { month: "short" })} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function safeRead(store: { readRaw(p: string): Promise<string> }, p: string): Promise<string> {
  try {
    return await store.readRaw(p)
  } catch {
    return ""
  }
}
