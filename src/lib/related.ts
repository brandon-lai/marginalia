import type { VaultIndex } from "./vault/index"
import type { Note } from "./vault/parse"

/**
 * Related notes panel (PRD §6.5). v1 is keyword and title matching — cheap, no
 * API call, and effective on a vault whose titles are clean concept names.
 *
 * This is the "am I about to write something I already have?" check, which is
 * what makes the app a learning tool rather than a clipping tool.
 */

export interface RelatedNote {
  note: Note
  score: number
  /** Normalised 0–1, for display. */
  similarity: number
  reasons: string[]
  excerpt: string
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "to", "of", "in", "on", "at", "by", "for",
  "with", "from", "as", "it", "its", "into", "about", "over", "after", "before", "not", "no",
  "you", "your", "we", "our", "they", "their", "he", "she", "his", "her", "i", "me", "my",
  "can", "will", "would", "should", "could", "may", "might", "must", "do", "does", "did",
  "have", "has", "had", "there", "here", "when", "where", "how", "what", "which", "who", "why",
  "one", "two", "some", "any", "all", "each", "more", "most", "other", "such", "only", "own",
  "same", "so", "up", "out", "down", "off", "just", "very", "also", "much", "many", "way", "get",
])

export function tokenise(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) ?? [])
    .map((w) => w.replace(/^['’-]+|['’-]+$/g, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/** Crude singularisation so "queues" matches the note titled "Queue". */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y"
  if (w.length > 4 && w.endsWith("ses")) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1)
  return w
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of tokens) {
    const s = stem(t)
    m.set(s, (m.get(s) ?? 0) + 1)
  }
  return m
}

/**
 * Score every note against the source text. Title matches dominate: on a vault
 * of clean concept names, a source that says "distributed tracing" six times is
 * about the note called Distributed Tracing, and no body-term overlap should
 * outrank that.
 */
export function relatedNotes(
  index: VaultIndex,
  sourceText: string,
  opts: { limit?: number; exclude?: Set<string> } = {},
): RelatedNote[] {
  const limit = opts.limit ?? 8
  const tokens = tokenise(sourceText)
  if (!tokens.length) return []
  const tf = termFreq(tokens)
  const total = tokens.length

  // Document frequency across the vault, so common vault words count for less.
  const df = new Map<string, number>()
  const candidates: Note[] = []
  for (const note of index.notes.values()) {
    if (note.type === "template" || note.type === "fleeting") continue
    if (opts.exclude?.has(note.path)) continue
    candidates.push(note)
    for (const t of new Set(tokenise(`${note.title} ${note.body}`).map(stem))) {
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }
  const N = Math.max(candidates.length, 1)
  const idf = (t: string) => Math.log(1 + N / (1 + (df.get(t) ?? 0)))

  const scored: RelatedNote[] = []
  for (const note of candidates) {
    const reasons: string[] = []
    let score = 0

    // 1. Whole title appearing in the source — the strongest signal available.
    const titleLower = note.title.toLowerCase()
    const sourceLower = sourceText.toLowerCase()
    const titleTokens = [...new Set(tokenise(note.title).map(stem))]
    // Coverage is measured against every content word in the title, including
    // ones tokenise() drops for being short. Without this, "IO and Storage"
    // reduces to the single token "storage" and an article that says "storage"
    // once scores as a perfect title match — which is exactly what it did.
    const titleWordCount = Math.max(
      titleTokens.length,
      note.title.split(/[\s,]+/).filter((w) => w.length > 1 && !STOPWORDS.has(w.toLowerCase())).length,
    )

    if (titleLower.length > 3 && sourceLower.includes(titleLower)) {
      const hits = sourceLower.split(titleLower).length - 1
      score += 14 + Math.min(hits, 5) * 4
      reasons.push(`title appears ${hits}×`)
    } else if (titleTokens.length) {
      // 2. Partial title-token overlap. Squared coverage, because one generic
      // word shared with a two-word title ("Consistent Hashing" against an
      // article that says "consistent" once) is noise, not a relation — and it
      // was outranking real matches before this was weighted.
      const matched = titleTokens.filter((t) => tf.has(t))
      if (matched.length) {
        const coverage = matched.length / titleWordCount
        // Weight each matched term by how often the source actually uses it.
        const strength =
          matched.reduce((a, t) => a + idf(t) * Math.log(1 + Math.min(tf.get(t) ?? 0, 8)), 0) / matched.length
        score += coverage * coverage * strength * 5
        if (coverage >= 0.5 && strength > 1) reasons.push(`title words: ${matched.join(", ")}`)
      }
    }

    // 3. Tag names present in the source text.
    for (const tag of note.tags) {
      const words = tag.split("-").map(stem)
      if (words.length && words.every((w) => (tf.get(w) ?? 0) >= 2)) {
        score += 2
        reasons.push(`#${tag}`)
      }
    }

    // 4. Body-term overlap, idf-weighted and length-normalised. This is what
    // finds a genuinely related note whose title shares no words at all.
    const bodyTokens = tokenise(note.body)
    if (bodyTokens.length) {
      const bt = termFreq(bodyTokens)
      let overlap = 0
      for (const [t, c] of bt) {
        const inSource = tf.get(t)
        if (inSource) overlap += Math.min(c, 4) * Math.min(inSource, 4) * idf(t) * idf(t)
      }
      const contribution = (overlap / Math.sqrt(bodyTokens.length * total)) * 4
      score += contribution
      if (contribution > 2.5 && reasons.length < 2) reasons.push("shared vocabulary")
    }

    // 5. A note the source's own subject area already links to is more likely
    // relevant than an unconnected one of the same score.
    if (note.incoming.length > 8) score *= 1.05

    // MOCs are hubs and match everything; they are rarely the useful answer.
    if (note.type === "moc") score *= 0.45

    if (score > 1.2) {
      scored.push({ note, score, similarity: 0, reasons: reasons.slice(0, 3), excerpt: excerptOf(note) })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, limit)
  // Saturating, absolute scale — not normalised against the best hit. A panel
  // that shows 99% for its top row regardless of how weak that row is tells the
  // reader nothing; "the best I found was 34%" is the useful signal.
  for (const r of top) r.similarity = r.score / (r.score + 14)
  return top
}

/** The first real sentence of the note, for the one-line excerpt. */
export function excerptOf(note: Note, max = 130): string {
  const lines = note.body.split("\n")
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (/^#{1,6}\s/.test(t)) continue
    if (/^\*.*\*$/.test(t)) continue // italic instruction-to-self
    if (/^[-*|>]/.test(t)) continue
    if (/^```/.test(t)) continue
    const clean = t.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1").replace(/[*_`]/g, "")
    return clean.length > max ? clean.slice(0, max).replace(/\s\S*$/, "") + "…" : clean
  }
  return ""
}

/**
 * Open todos across every MOC plus the genuine unresolved wikilinks: the
 * backlog queue (PRD §6.8), and the "open todo match" shown while reading.
 */
export interface BacklogItem {
  text: string
  kind: "todo" | "unresolved"
  source: string
  section?: string
  refs?: number
  /** Other MOCs listing the same topic, collapsed into this row. */
  alsoIn?: string[]
}

export function backlog(index: VaultIndex): BacklogItem[] {
  const out: BacklogItem[] = []
  for (const note of index.notes.values()) {
    if (note.type !== "moc" && note.type !== "tour") continue
    for (const t of note.todos) {
      if (t.done) continue
      out.push({ text: t.text.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1"), kind: "todo", source: note.path, section: t.section })
    }
  }
  for (const [target, refs] of index.unresolvedTargets) {
    if (target === "CLAUDE") continue // an ignored system file, not a future note
    out.push({
      text: target,
      kind: "unresolved",
      source: refs[0]?.from ?? "",
      refs: refs.reduce((a, r) => a + r.count, 0),
    })
  }
  return out
}

/** Backlog items that match what is being read right now. */
export function matchingBacklog(index: VaultIndex, sourceText: string, limit = 3): BacklogItem[] {
  const lower = sourceText.toLowerCase()
  const matches = backlog(index).filter((b) => b.text.length > 4 && lower.includes(b.text.toLowerCase()))

  // The same topic is often listed in several MOCs, and an unresolved link
  // usually duplicates a todo of the same name. Show each topic once, keeping
  // the strongest evidence and recording where else it appears.
  const byText = new Map<string, BacklogItem & { alsoIn: string[] }>()
  for (const m of matches) {
    const key = m.text.toLowerCase()
    const existing = byText.get(key)
    if (!existing) {
      byText.set(key, { ...m, alsoIn: [] })
      continue
    }
    existing.alsoIn.push(m.source)
    // An unresolved link is stronger evidence than a todo: something already
    // points at it and found nothing.
    if (m.kind === "unresolved" && existing.kind !== "unresolved") {
      byText.set(key, { ...m, alsoIn: [...existing.alsoIn, existing.source] })
    }
  }

  return [...byText.values()]
    .sort((a, b) => (b.refs ?? 0) - (a.refs ?? 0) || b.alsoIn.length - a.alsoIn.length)
    .slice(0, limit)
}
