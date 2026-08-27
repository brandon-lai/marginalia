import type { ProposalSet } from "../types"
import type { Note } from "../vault/parse"
import type { Highlight, Source } from "../types"

export interface CaptureContext {
  source: Source
  highlights: Highlight[]
  /** The full inbox capture file, if one exists. */
  inboxFile: string | null
  /** Plain text of the article, when the reader has it. */
  sourceText: string | null
}

export interface VaultContext {
  /** Every note title, one per line. Cheap, and it is what prevents duplicates. */
  titles: string[]
  folders: { folder: string; count: number }[]
  tags: { tag: string; count: number }[]
  /** The 5–8 most similar existing notes, in full. */
  similar: { note: Note; similarity: number }[]
  /** Topics To Explore lines from the subject MOCs that might match. */
  candidateTodos: { text: string; moc: string; section: string }[]
  /** brain/CLAUDE.md, read from disk at request time — never copied. */
  claudeMd: string
  /** Templates/Concept.md and Templates/Book.md, likewise. */
  templates: { concept: string; book: string }
  existingBasenames: Set<string>
}

export interface Extractor {
  propose(capture: CaptureContext, context: VaultContext): Promise<ProposalSet>
  readonly name: string
}
