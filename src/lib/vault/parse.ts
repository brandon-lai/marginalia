import matter from "gray-matter"
import { parseWikilinks, parseTags, isPlaceholderTarget, type Link } from "./wikilink"
import { slugifyFilePath } from "./slug"

export type NoteType = "concept" | "book" | "moc" | "tour" | "template" | "fleeting"

export interface Heading {
  depth: number
  text: string
}

export interface Todo {
  text: string
  done: boolean
  section: string
}

export interface Note {
  path: string
  folder: string
  title: string
  slug: string
  type: NoteType
  tags: string[]
  headings: Heading[]
  outgoing: Link[]
  incoming: { from: string; relation?: string; alias?: string }[]
  unresolved: string[]
  todos: Todo[]
  /** Raw markdown minus the H1 and the tag line. */
  body: string
  /** The untouched file, for safe round-tripping. */
  raw: string
  wordCount: number
  frontmatter: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

/** Classify from folder + tags, per guide §5.4. */
export function classify(relPath: string, tags: string[], title: string): NoteType {
  const folder = relPath.includes("/") ? relPath.split("/")[0] : ""
  if (folder === "Templates") return "template"
  if (folder === "Inbox") return "fleeting"
  if (folder === "Books") return "book"
  if (folder === "Homebase") {
    // A Homebase note tagged #moc and named "… MOC" is a MOC; the rest are
    // tour/collection pages (guide §2.3).
    if (tags.includes("moc") && /\bMOC$/.test(title)) return "moc"
    return "tour"
  }
  return "concept"
}

const WORD_RE = /[\p{L}\p{N}'’-]+/gu

export function parseNote(relPath: string, raw: string): Omit<Note, "incoming" | "unresolved"> {
  const parsed = matter(raw)
  const content = parsed.content
  const title = relPath.split("/").pop()!.replace(/\.md$/, "")
  const folder = relPath.includes("/") ? relPath.split("/").slice(0, -1).join("/") : ""

  const headings: Heading[] = []
  const todos: Todo[] = []
  let section = ""
  let inFence = false
  const bodyLines: string[] = []
  let seenH1 = false
  let tagLineIndex = -1

  const lines = content.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*```/.test(line)) inFence = !inFence

    if (!inFence) {
      const h = line.match(/^(#{1,6})\s+(.*)$/)
      if (h) {
        headings.push({ depth: h[1].length, text: h[2].trim() })
        if (h[1].length === 2) section = h[2].trim()
        if (h[1].length === 1 && !seenH1) {
          seenH1 = true
          continue // drop the H1 from body
        }
      }

      const t = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/)
      if (t) todos.push({ text: t[2].trim(), done: t[1].toLowerCase() === "x", section })

      // The tag line: the first non-heading line that is nothing but tags.
      if (tagLineIndex === -1 && line.trim() && /^(\s*#[\p{L}\p{N}_/-]+)+\s*$/u.test(line)) {
        tagLineIndex = i
        continue // drop the tag line from body
      }
    }

    bodyLines.push(line)
  }

  const tags = parseTags(content).filter((t) => t !== "tag" && t !== "hexcolor")
  const outgoing = parseWikilinks(content).filter((l) => !isPlaceholderTarget(l.target))
  const body = bodyLines.join("\n").replace(/^\n+/, "").trimEnd()
  const wordCount = (content.match(WORD_RE) ?? []).length

  return {
    path: relPath,
    folder,
    title: (parsed.data.title as string) || title,
    slug: slugifyFilePath(relPath),
    type: classify(relPath, tags, title),
    tags,
    headings,
    outgoing,
    todos,
    body,
    raw,
    wordCount,
    frontmatter: parsed.data ?? {},
  }
}
