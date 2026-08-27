/**
 * Structured edits to MOCs, never regex over the whole file (invariant 6).
 *
 * The file is split into a preamble plus one block per `## ` heading, each block
 * holding its own raw lines. Only the targeted block is rebuilt; every other
 * block is concatenated back byte for byte. That is what makes
 * "a MOC edit leaves every untouched section byte-identical" a property of the
 * design rather than a thing to hope for.
 */

export interface Section {
  /** The heading text, e.g. "Topics To Explore". Empty for the preamble. */
  heading: string
  /** Raw lines including the heading line itself. */
  lines: string[]
}

export function splitSections(content: string): Section[] {
  const lines = content.split("\n")
  const sections: Section[] = [{ heading: "", lines: [] }]
  let inFence = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const m = !inFence ? line.match(/^##\s+(.*)$/) : null
    if (m) sections.push({ heading: m[1].trim(), lines: [line] })
    else sections[sections.length - 1].lines.push(line)
  }
  if (sections[0].lines.length === 0 && sections.length > 1) sections.shift()
  return sections
}

export function joinSections(sections: Section[]): string {
  return sections.map((s) => s.lines.join("\n")).join("\n")
}

function findSection(sections: Section[], heading: string): number {
  const want = heading.trim().toLowerCase()
  return sections.findIndex((s) => s.heading.toLowerCase() === want)
}

export interface MocEditResult {
  content: string
  /** Human-readable diff lines for the review screen: real before/after, not a description. */
  diff: DiffLine[]
  warnings: string[]
}

export interface DiffLine {
  kind: "context" | "add" | "remove"
  text: string
  section: string
}

/**
 * Insert a live link under `section`, and remove the matching `- [ ]` item from
 * Topics To Explore if one exists. The protocol requires the todo be *removed*
 * and re-added as a live link, not left behind as a checked box (guide §3.4).
 */
export function applyMocUpdate(
  content: string,
  opts: { section: string; addLink: string; removeTodo?: string },
): MocEditResult {
  const sections = splitSections(content)
  const diff: DiffLine[] = []
  const warnings: string[] = []

  // 1. Insert the live link.
  let idx = findSection(sections, opts.section)
  if (idx === -1) {
    // Create the section immediately before Topics To Explore if it exists, so
    // new sections do not land after the backlog and the questions.
    const topicsIdx = findSection(sections, "Topics To Explore")
    const newSection: Section = { heading: opts.section, lines: [`## ${opts.section}`, "", `- ${opts.addLink}`, ""] }
    if (topicsIdx === -1) sections.push(newSection)
    else sections.splice(topicsIdx, 0, newSection)
    idx = topicsIdx === -1 ? sections.length - 1 : topicsIdx
    warnings.push(`Section "${opts.section}" did not exist in the MOC and was created.`)
    diff.push({ kind: "add", text: `## ${opts.section}`, section: opts.section })
    diff.push({ kind: "add", text: `- ${opts.addLink}`, section: opts.section })
  } else {
    const sec = sections[idx]
    const line = `- ${opts.addLink}`
    if (sec.lines.some((l) => l.trim() === line.trim())) {
      warnings.push("That link is already present in the MOC section; no change made.")
    } else {
      // Insert after the last list item in the section, else after the heading
      // and any italic instruction line.
      let insertAt = sec.lines.length
      let lastList = -1
      for (let i = 0; i < sec.lines.length; i++) {
        if (/^\s*[-*]\s+/.test(sec.lines[i])) lastList = i
      }
      if (lastList !== -1) {
        insertAt = lastList + 1
        diff.push({ kind: "context", text: sec.lines[lastList], section: sec.heading })
      } else {
        let i = 1
        while (i < sec.lines.length && (sec.lines[i].trim() === "" || /^\s*\*.*\*\s*$/.test(sec.lines[i]))) i++
        insertAt = i
        diff.push({ kind: "context", text: sec.lines[0], section: sec.heading })
      }
      sec.lines.splice(insertAt, 0, line)
      diff.push({ kind: "add", text: line, section: sec.heading })
    }
  }

  // 2. Remove the matching todo from Topics To Explore.
  if (opts.removeTodo) {
    const tIdx = findSection(sections, "Topics To Explore")
    if (tIdx === -1) {
      warnings.push("No Topics To Explore section in this MOC; nothing to remove.")
    } else {
      const sec = sections[tIdx]
      const want = normaliseTodo(opts.removeTodo)
      const at = sec.lines.findIndex((l) => {
        const m = l.match(/^\s*[-*]\s+\[\s\]\s+(.*)$/)
        return m ? normaliseTodo(m[1]) === want : false
      })
      if (at === -1) {
        warnings.push(`No open "- [ ] ${opts.removeTodo}" item found in Topics To Explore.`)
      } else {
        diff.push({ kind: "remove", text: sec.lines[at], section: sec.heading })
        sec.lines.splice(at, 1)
      }
    }
  }

  return { content: joinSections(sections), diff, warnings }
}

/** Todo text may carry a wikilink or trailing punctuation; compare on the bare concept. */
function normaliseTodo(s: string): string {
  return s
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[.,;:]+$/, "")
    .trim()
    .toLowerCase()
}

/** Every open todo in a MOC, with the section it came from. */
export function openTodos(content: string): { text: string; section: string }[] {
  const out: { text: string; section: string }[] = []
  for (const sec of splitSections(content)) {
    for (const line of sec.lines) {
      const m = line.match(/^\s*[-*]\s+\[\s\]\s+(.*)$/)
      if (m && m[1].trim()) out.push({ text: m[1].trim(), section: sec.heading })
    }
  }
  return out
}

/** Build a MOC from Templates/MOC.md for a brand-new subject. */
export function mocFromTemplate(template: string, subject: string, tag: string): string {
  return template
    .replace(/\{\{Subject\}\}/g, subject)
    .replace(/^#moc #tag\s*$/m, `#moc #${tag}`)
    .replace(/^- \[\[\]\]\s*$/gm, "")
    .replace(/^- \[ \]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
}
