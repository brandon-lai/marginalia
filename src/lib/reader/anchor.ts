/**
 * Text-quote anchoring (PRD §4.4). A DOM path breaks the moment a site
 * re-renders; a quote plus its surroundings survives.
 *
 * Resolution order:
 *   1. prefix + text + suffix — unambiguous almost always
 *   2. text alone, the occurrence nearest position_hint
 *   3. give up gracefully and report it unanchored
 *
 * A highlight is never discarded because it failed to anchor. Unanchored ones
 * render in the sidebar as quotes so the material is still there.
 */

export interface Selector {
  text: string
  prefix?: string
  suffix?: string
  positionHint?: number | null
}

export interface AnchorResult {
  start: number
  end: number
  strategy: "exact" | "quote" | "fuzzy"
}

/** Collapse whitespace so anchoring survives re-flowed markup. */
export function normalise(s: string): string {
  return s.replace(/\s+/g, " ")
}

/**
 * Build a normalised copy of `text` plus a map back to original offsets, so a
 * match found in normalised space can be reported in original coordinates.
 */
function normaliseWithMap(text: string): { norm: string; map: number[] } {
  const map: number[] = []
  let norm = ""
  let prevSpace = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      if (prevSpace) continue
      norm += " "
      map.push(i)
      prevSpace = true
    } else {
      norm += ch
      map.push(i)
      prevSpace = false
    }
  }
  map.push(text.length)
  return { norm, map }
}

export function anchor(haystack: string, sel: Selector): AnchorResult | null {
  const { norm, map } = normaliseWithMap(haystack)
  const needle = normalise(sel.text).trim()
  if (!needle) return null

  const toOriginal = (nStart: number, nEnd: number): AnchorResult | null => {
    const start = map[nStart]
    const end = map[Math.min(nEnd, map.length - 1)]
    if (start == null || end == null) return null
    return { start, end, strategy: "exact" }
  }

  // 1 & 2. Find every occurrence of the quote, then score each by how much of
  // its recorded context still surrounds it. prefix and suffix are the
  // characters *immediately* adjacent (§4.4), so they are matched against the
  // text either side of the occurrence rather than concatenated into one
  // string — a suffix that begins with punctuation has no space before it.
  const prefix = sel.prefix ? normalise(sel.prefix) : ""
  const suffix = sel.suffix ? normalise(sel.suffix) : ""

  const occurrences: number[] = []
  let from = 0
  for (;;) {
    const at = norm.indexOf(needle, from)
    if (at === -1) break
    occurrences.push(at)
    from = at + 1
    if (occurrences.length > 500) break
  }

  if (occurrences.length) {
    let best = occurrences[0]
    let bestScore = -Infinity
    for (const at of occurrences) {
      let score = 0
      if (prefix) {
        const before = norm.slice(Math.max(0, at - prefix.length - 2), at)
        if (before.trimEnd().endsWith(prefix.trimEnd())) score += 2
      }
      if (suffix) {
        const after = norm.slice(at + needle.length, at + needle.length + suffix.length + 2)
        if (after.trimStart().startsWith(suffix.trimStart())) score += 2
      }
      // Tie-break on distance to the recorded offset.
      const distance = sel.positionHint != null ? Math.abs(at - sel.positionHint) : 0
      const scored = score * 1e9 - distance
      if (scored > bestScore) {
        bestScore = scored
        best = at
      }
    }
    const contextMatched = bestScore >= 1e9
    const r = toOriginal(best, best + needle.length)
    if (r) {
      return {
        ...r,
        strategy: contextMatched || occurrences.length === 1 ? "exact" : "quote",
      }
    }
  }

  // 3. fuzzy: longest leading run of the quote that still matches uniquely.
  // Sites edit trailing words far more often than opening ones.
  for (const frac of [0.8, 0.6, 0.45]) {
    const partial = needle.slice(0, Math.max(24, Math.floor(needle.length * frac)))
    if (partial.length < 24) break
    const at = norm.indexOf(partial)
    if (at !== -1) {
      const r = toOriginal(at, at + partial.length)
      if (r) return { ...r, strategy: "fuzzy" }
    }
  }

  return null
}

export interface AnchoredHighlight<T> {
  highlight: T
  range: AnchorResult | null
}

/**
 * Anchor a set of highlights into one text, dropping overlaps so the wrapper
 * markup cannot nest and produce broken HTML. Later (longer) highlights lose to
 * earlier ones; the loser is reported unanchored rather than discarded.
 */
export function anchorAll<T extends Selector & { id: string }>(
  haystack: string,
  highlights: T[],
): AnchoredHighlight<T>[] {
  const results: AnchoredHighlight<T>[] = highlights.map((h) => ({ highlight: h, range: anchor(haystack, h) }))
  const taken: [number, number][] = []
  for (const r of results) {
    if (!r.range) continue
    const overlaps = taken.some(([s, e]) => r.range!.start < e && s < r.range!.end)
    if (overlaps) r.range = null
    else taken.push([r.range.start, r.range.end])
  }
  return results
}
