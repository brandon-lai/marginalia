import { NextResponse } from "next/server"
import { getIndex } from "@/lib/vault/index"
import { excerptOf } from "@/lib/related"
import { Document } from "flexsearch"

export const dynamic = "force-dynamic"

interface SearchDoc {
  [key: string]: string
  id: string
  title: string
  body: string
  tags: string
}

// Rebuilt whenever the vault index is. At 237 notes that is a few milliseconds,
// so there is no separate cache to invalidate.
let cached: { builtAt: number; doc: Document<SearchDoc> } | null = null

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ hits: [] })

  const index = await getIndex()
  if (!cached || cached.builtAt !== index.builtAt) {
    const doc = new Document<SearchDoc>({
      document: { id: "id", index: ["title", "body", "tags"] },
      tokenize: "forward",
    })
    for (const note of index.notes.values()) {
      if (note.type === "template") continue
      doc.add({ id: note.path, title: note.title, body: note.body, tags: note.tags.join(" ") })
    }
    cached = { builtAt: index.builtAt, doc }
  }

  // Title matches first: on a vault of clean concept names the title field is
  // almost always the answer the reader wanted.
  const paths: string[] = []
  const collect = (raw: unknown) => {
    for (const field of (raw as { result?: unknown[] }[]) ?? []) {
      for (const id of (field.result ?? []) as string[]) {
        if (typeof id === "string" && !paths.includes(id)) paths.push(id)
      }
    }
  }
  collect(cached.doc.search(q, { limit: 12, index: ["title"] }))
  collect(cached.doc.search(q, { limit: 12 }))

  const hits = paths
    .slice(0, 12)
    .map((p) => index.notes.get(p))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((note) => ({
      path: note.path,
      title: note.title,
      folder: note.folder,
      excerpt: excerptOf(note),
    }))

  return NextResponse.json({ hits })
}
