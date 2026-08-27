/**
 * Rebuilds the note_index cache from the vault.
 *
 * note_index is derived, never a second copy of the vault: it holds paths,
 * metadata and (later) embeddings, not note bodies. If it disagrees with the
 * files, the files win and this is the fix. PRD §11 requires that wiping the
 * database and rebuilding loses no notes and no committed work — nothing here
 * reads or writes anything under brain/ except to read it.
 */
import "./load-env.mjs"
import { buildIndex } from "../src/lib/vault/index.ts"
import { rebuildNoteIndex } from "../src/lib/db/repo.ts"
import { hashContent } from "../src/lib/vault/store.ts"

const index = await buildIndex()
const notes = [...index.notes.values()]
  .filter((n) => n.type !== "template")
  .map((n) => ({
    path: n.path,
    title: n.title,
    folder: n.folder,
    slug: n.slug,
    type: n.type,
    tags: n.tags,
    contentHash: hashContent(n.raw),
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }))

const count = await rebuildNoteIndex(notes)
console.log(`note_index rebuilt from ${index.root}: ${count} rows`)
process.exit(0)
