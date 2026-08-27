import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import type { Extractor, CaptureContext, VaultContext } from "./types"
import type { ProposalSet, ProposedNote } from "../types"
import { buildSystemPrompt, buildUserPrompt } from "./prompt"

/**
 * The one implementation of Extractor (PRD §7). Everything above it talks to
 * the interface, so a run inside Claude Code — or any other backend — slots in
 * later without touching the review screen.
 */
export class AnthropicExtractor implements Extractor {
  readonly name = "anthropic"
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async propose(capture: CaptureContext, ctx: VaultContext): Promise<ProposalSet> {
    const system = buildSystemPrompt(ctx)
    const user = buildUserPrompt(capture, ctx)

    const res = await this.client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16_000,
      system,
      messages: [{ role: "user", content: user }],
    })

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    return normaliseProposalSet(parseJson(text), capture, ctx)
  }
}

/** The model may wrap the object in prose or a fence despite being told not to. */
export function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start === -1 || end === -1) {
    throw new Error(`The extractor returned no JSON object. First 200 chars: ${text.slice(0, 200)}`)
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

/**
 * Enforce, server-side, everything the prompt asked for. The model is not
 * trusted with the vault's invariants — a proposal that breaks one is corrected
 * or marked here, before it can reach the review screen and be accepted.
 */
export function normaliseProposalSet(
  raw: unknown,
  capture: CaptureContext,
  ctx: VaultContext,
): ProposalSet {
  const obj = (raw ?? {}) as { notes?: unknown[]; unused?: unknown[] }
  const reacted = new Set(capture.highlights.filter((h) => h.note?.trim()).map((h) => h.id))

  const notes: ProposedNote[] = []
  for (const n of obj.notes ?? []) {
    const note = n as Partial<ProposedNote>
    if (!note.title || !note.markdown) continue

    const title = String(note.title).trim()
    const usedHighlights = Array.isArray(note.usedHighlights) ? note.usedHighlights.map(String) : []

    // §8 mitigation 2 / open question Q5: the no-reaction marker is set by the
    // server from the actual highlight data, never taken from the model.
    const noReaction = usedHighlights.length > 0 && !usedHighlights.some((id) => reacted.has(id))

    let confidence = typeof note.confidence === "number" ? note.confidence : 0.5
    if (noReaction) confidence = Math.min(confidence, 0.49)

    let markdown = String(note.markdown)
    // Invariant 3: H1 equals the filename stem. Invariant 4: no frontmatter.
    markdown = stripFrontmatter(markdown)
    markdown = forceH1(markdown, title)

    notes.push({
      action: note.action === "enrich" ? "enrich" : "create",
      title,
      folder: String(note.folder ?? "").trim(),
      tags: Array.isArray(note.tags) ? note.tags.map((t) => String(t).replace(/^#/, "")) : [],
      markdown,
      links: Array.isArray(note.links)
        ? note.links.map((l) => {
            const link = l as { target?: unknown; relation?: unknown }
            const target = String(link.target ?? "").trim()
            return {
              target,
              relation: String(link.relation ?? "Related"),
              // exists is recomputed from the index; the model's guess is ignored.
              exists: ctx.existingBasenames.has(target),
            }
          })
        : [],
      mocUpdate: note.mocUpdate,
      sourceAttribution: note.sourceAttribution ?? {
        url: capture.source.url,
        title: capture.source.title,
      },
      rationale: String(note.rationale ?? ""),
      confidence,
      usedHighlights,
      noReaction,
    })
  }

  const unused = (obj.unused ?? []).map((u) => {
    const item = u as { highlight?: unknown; reason?: unknown }
    return { highlight: String(item.highlight ?? ""), reason: String(item.reason ?? "") }
  })

  // Anything the model forgot to mention is still unused; say so rather than
  // letting a highlight disappear silently.
  const mentioned = new Set([...notes.flatMap((n) => n.usedHighlights), ...unused.map((u) => u.highlight)])
  for (const h of capture.highlights) {
    if (!mentioned.has(h.id)) {
      unused.push({ highlight: h.id, reason: "Not referenced by the extractor." })
    }
  }

  return { notes, unused }
}

export function stripFrontmatter(md: string): string {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
}

export function forceH1(md: string, title: string): string {
  const lines = md.split("\n")
  const idx = lines.findIndex((l) => /^#\s+/.test(l))
  if (idx === -1) return `# ${title}\n\n${md.replace(/^\n+/, "")}`
  lines[idx] = `# ${title}`
  return lines.slice(idx).join("\n")
}
