import { splitSections, joinSections, type DiffLine } from "./moc"

/**
 * index.md has two jobs after a note is accepted (guide §4.4): rewrite the
 * "Recently Added" block from git, and — only when a brand-new subject was
 * created — append a card to the hand-written `.subject-grid` div.
 *
 * Both are structural edits. The subject grid is raw HTML inside markdown, so
 * the card is inserted immediately before the closing </div> rather than by
 * re-serialising HTML we did not write.
 */

export function updateRecentlyAdded(
  content: string,
  recent: { title: string; date: string }[],
): { content: string; diff: DiffLine[] } {
  const sections = splitSections(content)
  const idx = sections.findIndex((s) => s.heading.toLowerCase() === "recently added")
  const lines = recent.map((r) => `- [[${r.title}]] — ${r.date}`)
  const diff: DiffLine[] = []

  if (idx === -1) {
    sections.push({ heading: "Recently Added", lines: ["## Recently Added", "", ...lines, ""] })
    for (const l of lines) diff.push({ kind: "add", text: l, section: "Recently Added" })
    return { content: joinSections(sections), diff }
  }

  const sec = sections[idx]
  const old = sec.lines.filter((l) => /^\s*-\s+\[\[/.test(l))
  for (const l of old) if (!lines.includes(l)) diff.push({ kind: "remove", text: l, section: "Recently Added" })
  for (const l of lines) if (!old.includes(l)) diff.push({ kind: "add", text: l, section: "Recently Added" })

  // Keep the heading, any trailing blank lines and any non-list prose intact.
  const trailing: string[] = []
  for (let i = sec.lines.length - 1; i >= 0 && sec.lines[i].trim() === ""; i--) trailing.unshift(sec.lines[i])
  sec.lines = [sec.lines[0], "", ...lines, ...trailing]

  return { content: joinSections(sections), diff }
}

export function subjectCardHtml(subject: string, mocSlug: string, description: string): string {
  const cls = subject.toLowerCase().replace(/\s+/g, "-")
  return [
    `  <a href="/${mocSlug}" class="subject-card ${cls}">`,
    "    <div class=\"card-body\">",
    `      <div class="card-title">${escapeHtml(subject)}</div>`,
    `      <div class="card-desc">${escapeHtml(description)}</div>`,
    "    </div>",
    "  </a>",
  ].join("\n")
}

export function appendSubjectCard(
  content: string,
  card: string,
): { content: string; diff: DiffLine[]; ok: boolean } {
  const open = content.indexOf('<div class="subject-grid">')
  if (open === -1) return { content, diff: [], ok: false }
  // The matching close is the last </div> before the next markdown heading.
  const after = content.slice(open)
  const nextHeading = after.search(/\n##\s/)
  const region = nextHeading === -1 ? after : after.slice(0, nextHeading)
  const closeRel = region.lastIndexOf("</div>")
  if (closeRel === -1) return { content, diff: [], ok: false }
  const closeAbs = open + closeRel
  const next = content.slice(0, closeAbs) + card + "\n" + content.slice(closeAbs)
  return {
    content: next,
    diff: card.split("\n").map((text) => ({ kind: "add" as const, text, section: "Subjects" })),
    ok: true,
  }
}

/** A border-color rule for the new subject, appended to quartz/styles/custom.scss. */
export function subjectColorRule(subject: string, color: string): string {
  const cls = subject.toLowerCase().replace(/\s+/g, "-")
  return `\n.subject-card.${cls} { border-color: ${color}; }\n`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
