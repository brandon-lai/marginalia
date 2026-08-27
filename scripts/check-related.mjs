import { buildIndex } from "../src/lib/vault/index.ts"
import { relatedNotes, matchingBacklog, backlog } from "../src/lib/related.ts"
import { DEMO_READER } from "../src/lib/db/demo-data.ts"

const idx = await buildIndex()
console.log(`indexed ${idx.notes.size} notes\n`)

for (const key of ["demo:tracing", "demo:queues"]) {
  const art = DEMO_READER[key]
  const text = art.html.replace(/<[^>]+>/g, " ")
  console.log(`=== ${art.title} ===`)
  for (const r of relatedNotes(idx, text, { limit: 6 })) {
    console.log(`  ${(r.similarity * 100).toFixed(0).padStart(3)}%  ${r.note.title.padEnd(34)} ${r.note.folder.padEnd(18)} [${r.reasons.join("; ")}]`)
  }
  const m = matchingBacklog(idx, text)
  console.log(`  open todo matches: ${m.map(x => `${x.text} (${x.kind})`).join(", ") || "none"}\n`)
}
console.log("backlog size:", backlog(idx).length)
