/**
 * Wikilink parsing, matching Quartz's ObsidianFlavoredMarkdown transformer.
 *
 * The character class excludes only `[`, `]`, `|`, `#` and `\` — exactly as
 * Quartz's `ofm.ts` does. It deliberately permits `.` inside the target.
 *
 * System guide §3.3 records this as a live data bug: `Art/Byzantine vs. Western
 * Depictions of Christ.md` exists, six links point at it, and a naive parser
 * that treats `.` as an extension boundary truncates the target to
 * "Byzantine vs". Quartz resolves it correctly; a hand-rolled parser will not
 * unless it is written this way. See tests/wikilink.test.mjs.
 */

export const RELATIONS = [
  "Related",
  "Builds on",
  "Enables",
  "Contrasts with",
  "Compare",
  "See",
] as const

export type Relation = (typeof RELATIONS)[number]

export interface Link {
  /** Bare basename as written, e.g. "Byzantine vs. Western Depictions of Christ" */
  target: string
  alias?: string
  heading?: string
  isEmbed: boolean
  /** Parsed from a `## Connections` line prefix, when present. */
  relation?: Relation
}

// group 1: target, group 2: #heading (or block ref), group 3: |alias
const WIKILINK_RE = /!?\[\[([^\[\]\|#\\]+)?(#+[^\[\]\|#\\]+)?(\\?\|[^\[\]#]*)?\]\]/g

/** True when the target is a template/doc placeholder rather than a real note. */
export function isPlaceholderTarget(target: string): boolean {
  const t = target.trim()
  return t === "" || t === "wikilinks" || t === "Note Name" || t === "links" || t === "Subject MOC"
}

/** Extract every wikilink from a markdown body, with relation prefixes attached. */
export function parseWikilinks(markdown: string): Link[] {
  const links: Link[] = []
  const lines = markdown.split("\n")

  let inConnections = false
  for (const line of lines) {
    const heading = line.match(/^##\s+(.*)$/)
    if (heading) inConnections = /^connections$/i.test(heading[1].trim())

    const relation = inConnections ? relationOf(line) : undefined

    WIKILINK_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WIKILINK_RE.exec(line)) !== null) {
      const raw = m[0]
      const target = (m[1] ?? "").trim()
      if (!target && !m[2]) continue

      const headingPart = m[2]?.replace(/^#+/, "").trim()
      const aliasRaw = m[3]?.replace(/^\\?\|/, "").trim()
      const alias = aliasRaw ? aliasRaw : undefined

      links.push({
        target,
        alias,
        heading: headingPart || undefined,
        isEmbed: raw.startsWith("!"),
        relation,
      })
    }
  }

  return links
}

/** `- Builds on: [[X]]` -> "Builds on". Case-insensitive, tolerates missing space. */
export function relationOf(line: string): Relation | undefined {
  const m = line.match(/^\s*[-*]?\s*([A-Za-z][A-Za-z\s]*?)\s*:/)
  if (!m) return undefined
  const found = RELATIONS.find((r) => r.toLowerCase() === m[1].trim().toLowerCase())
  return found
}

/**
 * Resolve a wikilink target to a vault path using Quartz's
 * `markdownLinkResolution: "shortest"` strategy: strip any folder prefix and a
 * trailing `.md`, then look up the bare basename.
 */
export function resolveTarget(target: string, byBasename: Map<string, string>): string | undefined {
  const bare = basenameOf(target)
  return byBasename.get(bare) ?? byBasename.get(bare.toLowerCase())
}

/** "Computer Science/Big O.md" -> "Big O"; "Big O" -> "Big O". */
export function basenameOf(target: string): string {
  let t = target.trim()
  const slash = t.lastIndexOf("/")
  if (slash !== -1) t = t.slice(slash + 1)
  // Only strip a literal ".md" extension. Never split on the first dot —
  // that is the Byzantine bug.
  if (t.toLowerCase().endsWith(".md")) t = t.slice(0, -3)
  return t
}

/** Inline tags, matching Quartz's ofm.ts: `#` at start-of-line or after a space. */
export function parseTags(markdown: string): string[] {
  const out = new Set<string>()
  // Skip fenced code blocks so `#hexcolor`-style noise in snippets is ignored.
  const lines = markdown.split("\n")
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (/^\s*#{1,6}\s/.test(line)) continue // markdown heading, not a tag
    const re = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) out.add(m[1])
  }
  return [...out]
}
