import { NextResponse } from "next/server"
import { getSource, listHighlights, saveProposals, setSourceStatus } from "@/lib/db/repo"
import { getExtractor, buildVaultContext } from "@/lib/extract/context"
import { getStore } from "@/lib/vault/index"
import { getConfig } from "@/lib/config"
import { newId } from "@/lib/db/client"
import { readCache } from "@/lib/reader/cache"
import { DEMO_READER } from "@/lib/db/demo-data"
import { htmlToText } from "@/lib/reader/extract"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Extraction runs only on explicit request, never automatically (§6.3).
 * Nothing it produces touches disk — proposals go to the review gate.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { sourceId?: string } | null
  if (!body?.sourceId) return NextResponse.json({ ok: false, error: "sourceId is required." }, { status: 400 })

  const source = await getSource(body.sourceId)
  if (!source) return NextResponse.json({ ok: false, error: "No such source." }, { status: 404 })

  const highlights = await listHighlights(source.id)
  if (!highlights.length) {
    return NextResponse.json(
      { ok: false, error: "This source has no highlights. Extraction runs on highlights, not on whole articles." },
      { status: 400 },
    )
  }

  const cfg = getConfig()
  const store = getStore()

  let inboxFile: string | null = null
  if (source.inboxPath) {
    inboxFile = await store.readRaw(source.inboxPath).catch(() => null)
  }

  let sourceText: string | null = null
  if (source.readerHtmlKey) {
    const demo = DEMO_READER[source.readerHtmlKey]
    if (demo) sourceText = htmlToText(demo.html)
    else {
      const cached = await readCache(source.readerHtmlKey)
      if (cached) sourceText = cached.text ?? htmlToText(cached.html)
    }
  }

  const capture = { source, highlights, inboxFile, sourceText }
  const ctx = await buildVaultContext(capture)
  const { extractor, isDemo } = getExtractor()

  let set
  try {
    set = await extractor.propose(capture, ctx)
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Extraction failed: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  const runId = newId("run")
  let saved = false
  if (cfg.hasDatabase) {
    try {
      await saveProposals(source.id, runId, set.notes)
      await setSourceStatus(source.id, "processing")
      saved = true
    } catch (e) {
      console.error("[marginalia] proposals generated but not saved:", e)
    }
  }

  return NextResponse.json({
    ok: true,
    runId,
    extractor: extractor.name,
    isDemo,
    saved,
    notes: set.notes,
    unused: set.unused,
    context: {
      titlesSent: ctx.titles.length,
      similarNotes: ctx.similar.map((s) => ({ path: s.note.path, similarity: s.similarity })),
      todosConsidered: ctx.candidateTodos.length,
      claudeMdBytes: ctx.claudeMd.length,
    },
  })
}
