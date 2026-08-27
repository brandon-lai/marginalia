import type { CaptureContext, VaultContext } from "./types"

/**
 * The app's own prompt holds only what is specific to this pipeline: the JSON
 * output contract, the highlight-versus-reaction weighting from §8, and the
 * rule that verbatim source text never reaches a permanent note.
 *
 * The vault's actual rules are NOT here. They are read from brain/CLAUDE.md at
 * request time and injected below, so editing CLAUDE.md in Obsidian changes the
 * app's behaviour on the next run with no deploy and no second copy to drift
 * (PRD §7).
 */

export const PIPELINE_RULES = `
You are extracting permanent notes from something Brandon read on the web and
highlighted. You are operating the extraction step of a pipeline whose next step
is a human review gate: everything you propose is shown to Brandon and accepted,
edited or rejected one note at a time. Propose what is worth keeping; do not
pad, and do not try to be comprehensive.

## The voice problem — read this twice

A highlight is, by definition, someone else's words. Brandon's reaction to it is
his. The vault's founding rule is own words only, nothing is pasted.

- Brandon's reaction carries the framing and the "## Why It Matters" section.
  The highlight supplies the facts for "## What It Is" and "## How It Works".
- NEVER carry verbatim source text into a permanent note. Not one sentence.
  Quoted highlights stay in the inbox capture file. The permanent note is
  rewritten prose plus a "## Source" section linking the URL. This is a voice
  rule and a copyright rule at once.
- If a proposed note has no reaction of Brandon's to draw on, set confidence
  below 0.5 and say so plainly in the rationale. A highlight with a reaction is
  raw material; a highlight without one is a bookmark.
- Write as a tutor reviewing your student's notes, not as a textbook author. If
  you find yourself writing an encyclopedia entry, stop: that degrades the vault
  even though the file count goes up.

## Hard structural rules

- One concept, one note. If the material contains three ideas, propose three
  notes, not one long one.
- H1 must equal the title exactly, which must equal the intended filename stem.
- Basenames are globally unique across the entire vault. You are given every
  existing title; do not propose one that collides.
- Wikilinks are bare basenames: [[Big O]], never [[Computer Science/Big O]].
- No YAML frontmatter on permanent notes. Ever. The tag line is line 3, a bare
  space-separated run of inline tags.
- Link liberally, including to notes that do not exist yet — an unresolved
  wikilink is a deliberate to-do, and you should mark those with exists: false.
- Every note must update its subject MOC. If a "- [ ]" item in Topics To Explore
  matches the note you are proposing, set removeTodo to that item's exact text
  so it is promoted into a live link rather than left as a checked box.

## Output contract

Return ONLY a JSON object, no prose around it, matching:

{
  "notes": [{
    "action": "create" | "enrich",
    "title": "Distributed Tracing",
    "folder": "System Design",
    "tags": ["system-design"],
    "markdown": "# Distributed Tracing\\n\\n#system-design\\n\\n## What It Is\\n...",
    "links": [{"target": "Message Queue", "relation": "Related", "exists": true}],
    "mocUpdate": {
      "file": "Homebase/System Design MOC.md",
      "section": "Intermediate Concepts",
      "removeTodo": "Distributed Tracing",
      "addLink": "[[Distributed Tracing]] — spans, context propagation, sampling"
    },
    "sourceAttribution": {"url": "...", "title": "..."},
    "rationale": "Which highlights this came from and what of Brandon's framing was kept.",
    "confidence": 0.85,
    "usedHighlights": ["hl_01", "hl_02"]
  }],
  "unused": [{"highlight": "hl_03", "reason": "Restates an existing point in Cache."}]
}

"relation" must be one of: Related, Builds on, Enables, Contrasts with, Compare, See.
"unused" matters: it tells Brandon what was dropped and why, so the review screen
can offer to force a note from a highlight anyway. List every highlight you did
not use.
`.trim()

export function buildSystemPrompt(ctx: VaultContext): string {
  return [
    "The following is brain/CLAUDE.md, the vault's own specification, read from",
    "disk just now. It is the authority on how notes in this vault are written.",
    "Follow it exactly.",
    "",
    "<vault_rules>",
    ctx.claudeMd.trim(),
    "</vault_rules>",
    "",
    "The note shapes come from the vault's own templates, also read from disk:",
    "",
    "<template name=\"Concept\">",
    ctx.templates.concept.trim(),
    "</template>",
    "",
    "<template name=\"Book\">",
    ctx.templates.book.trim(),
    "</template>",
    "",
    PIPELINE_RULES,
  ].join("\n")
}

export function buildUserPrompt(capture: CaptureContext, ctx: VaultContext): string {
  const parts: string[] = []

  parts.push("<source>")
  parts.push(`title: ${capture.source.title}`)
  parts.push(`url: ${capture.source.url}`)
  if (capture.source.author) parts.push(`author: ${capture.source.author}`)
  parts.push("</source>", "")

  if (capture.inboxFile) {
    parts.push("<inbox_capture_file>", capture.inboxFile.trim(), "</inbox_capture_file>", "")
  }

  parts.push("<highlights>")
  for (const h of capture.highlights) {
    parts.push(`<highlight id="${h.id}" color="${h.color}">`)
    parts.push(`quoted: ${h.text}`)
    if (h.note?.trim()) parts.push(`BRANDON'S REACTION: ${h.note.trim()}`)
    else parts.push("BRANDON'S REACTION: (none — this is a bookmark, not raw material)")
    parts.push("</highlight>")
  }
  parts.push("</highlights>", "")

  parts.push(
    "<existing_note_titles>",
    "Every note already in the vault. Do not propose a title that collides with one of these.",
    ...ctx.titles,
    "</existing_note_titles>",
    "",
  )

  parts.push(
    "<folders>",
    ...ctx.folders.map((f) => `${f.folder} (${f.count})`),
    "</folders>",
    "",
    "<tags>",
    ...ctx.tags.map((t) => `#${t.tag} (${t.count})`),
    "</tags>",
    "",
  )

  if (ctx.candidateTodos.length) {
    parts.push(
      "<open_topics_to_explore>",
      "Open '- [ ]' items in the subject MOCs that may match this material. If one",
      "does, put its exact text in mocUpdate.removeTodo.",
      ...ctx.candidateTodos.map((t) => `- [ ] ${t.text}   (in ${t.moc}, section: ${t.section})`),
      "</open_topics_to_explore>",
      "",
    )
  }

  if (ctx.similar.length) {
    parts.push(
      "<most_similar_existing_notes>",
      "Read these in full before proposing anything. If the material is already",
      "covered, propose an 'enrich' action or nothing at all rather than a duplicate.",
    )
    for (const s of ctx.similar) {
      parts.push(`<note path="${s.note.path}" similarity="${s.similarity.toFixed(2)}">`)
      parts.push(s.note.raw.trim())
      parts.push("</note>")
    }
    parts.push("</most_similar_existing_notes>", "")
  }

  if (capture.sourceText) {
    parts.push(
      "<article_text>",
      "The full article, for context on what the highlights meant. Do not summarise",
      "the article. Only propose notes that Brandon's highlights and reactions point at.",
      capture.sourceText.slice(0, 40_000),
      "</article_text>",
      "",
    )
  }

  parts.push(
    "Propose the permanent notes worth adding to the vault from this source.",
    "Return only the JSON object.",
  )

  return parts.join("\n")
}
