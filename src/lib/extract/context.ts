import "server-only"
import { getIndex, getStore, subjectFolders, mocFor } from "../vault/index"
import { relatedNotes } from "../related"
import { openTodos } from "../vault/moc"
import type { VaultContext, CaptureContext } from "./types"
import type { Extractor } from "./types"
import { AnthropicExtractor } from "./anthropic"
import { DemoExtractor } from "./demo"
import { getConfig } from "../config"

/** The one place that decides which extractor runs. */
export function getExtractor(): { extractor: Extractor; isDemo: boolean } {
  const cfg = getConfig()
  if (cfg.hasAnthropic) {
    return { extractor: new AnthropicExtractor(process.env.ANTHROPIC_API_KEY!), isDemo: false }
  }
  return { extractor: new DemoExtractor(), isDemo: true }
}

/**
 * Assemble everything §6.6 step 1 asks for. Context is what makes the output
 * good, and all of it is cheap: 237 titles is a few hundred tokens.
 */
export async function buildVaultContext(capture: CaptureContext): Promise<VaultContext> {
  const index = await getIndex()
  const store = getStore()

  const material = [
    capture.source.title,
    ...capture.highlights.map((h) => `${h.text} ${h.note ?? ""}`),
    capture.sourceText ?? "",
  ].join("\n")

  const similar = relatedNotes(index, material, { limit: 6 }).map((r) => ({
    note: r.note,
    similarity: r.similarity,
  }))

  const titles = [...index.notes.values()]
    .filter((n) => n.type !== "template" && n.type !== "fleeting")
    .map((n) => n.title)
    .sort()

  // Topics To Explore lines from the MOCs of the subjects the similar notes sit
  // in — the ones that could plausibly match this material.
  const candidateFolders = new Set(similar.map((s) => s.note.folder).filter(Boolean))
  const candidateTodos: VaultContext["candidateTodos"] = []
  for (const folder of candidateFolders) {
    const moc = mocFor(index, folder)
    if (!moc) continue
    for (const t of openTodos(moc.raw)) {
      candidateTodos.push({ text: t.text, moc: moc.path, section: t.section })
    }
  }
  // Plus any MOC todo whose text literally appears in the material.
  const lower = material.toLowerCase()
  for (const note of index.notes.values()) {
    if (note.type !== "moc") continue
    for (const t of note.todos) {
      if (t.done) continue
      const bare = t.text.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
      if (bare.length > 4 && lower.includes(bare.toLowerCase())) {
        if (!candidateTodos.some((c) => c.text === t.text && c.moc === note.path)) {
          candidateTodos.push({ text: t.text, moc: note.path, section: t.section })
        }
      }
    }
  }

  // Read CLAUDE.md and the templates from disk at request time. Never copied,
  // so editing them in Obsidian changes behaviour with no deploy (PRD §7).
  const claudeMd = await safeRead(store, "CLAUDE.md")
  const conceptTpl = await safeRead(store, "Templates/Concept.md")
  const bookTpl = await safeRead(store, "Templates/Book.md")

  return {
    titles,
    folders: subjectFolders(index),
    tags: [...index.tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .filter((t) => t.tag !== "tag" && t.tag !== "hexcolor")
      .sort((a, b) => b.count - a.count),
    similar,
    candidateTodos: candidateTodos.slice(0, 60),
    claudeMd,
    templates: { concept: conceptTpl, book: bookTpl },
    existingBasenames: new Set(index.byBasename.keys()),
  }
}

async function safeRead(store: { readRaw(p: string): Promise<string> }, p: string): Promise<string> {
  try {
    return await store.readRaw(p)
  } catch {
    return ""
  }
}
