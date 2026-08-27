import { buildIndex, subjectFolders } from "../src/lib/vault/index.ts"

const idx = await buildIndex()
const notes = [...idx.notes.values()]
console.log("notes indexed:", notes.length)
console.log("collisions:", idx.collisions)
console.log("folders:", idx.folders.join(", "))
console.log("subject folders:", subjectFolders(idx).map(f => `${f.folder}(${f.count})`).join(" "))
const types = {}
for (const n of notes) types[n.type] = (types[n.type] ?? 0) + 1
console.log("types:", types)
const edges = notes.reduce((a, n) => a + n.incoming.length, 0)
console.log("resolved edges:", edges)
const occ = notes.reduce((a, n) => a + n.outgoing.filter(l => !l.isEmbed).length, 0)
console.log("wikilink occurrences (non-embed):", occ)
console.log("distinct unresolved targets:", idx.unresolvedTargets.size)
console.log("unresolved:", [...idx.unresolvedTargets.entries()]
  .map(([t, refs]) => `${t}(${refs.reduce((a,r)=>a+r.count,0)})`).sort().join(" "))
const todos = notes.reduce((a, n) => a + n.todos.filter(t => !t.done).length, 0)
console.log("open todos:", todos)
console.log("distinct tags:", idx.tagCounts.size)
console.log("avg words:", Math.round(notes.filter(n=>n.type==='concept'||n.type==='book').reduce((a,n)=>a+n.wordCount,0) / notes.filter(n=>n.type==='concept'||n.type==='book').length))

// THE test case, against the real vault
const byz = "Byzantine vs. Western Depictions of Christ"
console.log("\n--- Byzantine test against the real vault ---")
console.log("note exists at:", idx.byBasename.get(byz))
const refs = notes.filter(n => n.outgoing.some(l => l.target === byz))
console.log("notes linking to it:", refs.length, refs.map(n=>n.path))
const target = idx.notes.get(idx.byBasename.get(byz))
console.log("its backlinks:", target?.incoming.length)
console.log("truncated 'Byzantine vs' in unresolved?", idx.unresolvedTargets.has("Byzantine vs"))

const ll = idx.notes.get("Computer Science/Linked List.md")
console.log("\n--- sample note ---")
console.log({ title: ll?.title, slug: ll?.slug, tags: ll?.tags, type: ll?.type,
  created: ll?.createdAt, updated: ll?.updatedAt, words: ll?.wordCount,
  outgoing: ll?.outgoing.map(l=>`${l.relation??'-'}:${l.target}`), backlinks: ll?.incoming.length })
