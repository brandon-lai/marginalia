import { NextResponse } from "next/server"
import { getConfig } from "@/lib/config"
import { getStore, invalidateIndex } from "@/lib/vault/index"
import { appendCapture } from "@/lib/vault/inbox"
import { insertHighlight, getSource, setSourceInboxPath, setSourceStatus } from "@/lib/db/repo"
import { newId } from "@/lib/db/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Highlighting from inside the app's own reader. Same semantics as
 * /api/capture — inbox file first, database second — but authenticated by
 * being same-origin rather than by the extension's shared secret.
 */
export async function POST(req: Request) {
  const cfg = getConfig()
  const body = (await req.json().catch(() => null)) as
    | { sourceId?: string; url?: string; title?: string; selection?: string; prefix?: string; suffix?: string; positionHint?: number; note?: string; color?: "yellow" | "green" | "blue" | "pink" }
    | null

  if (!body?.sourceId || !body.selection?.trim()) {
    return NextResponse.json({ ok: false, error: "sourceId and selection are required." }, { status: 400 })
  }
  if (!cfg.canWrite) {
    return NextResponse.json(
      { ok: false, error: "No vault is configured (BRAIN_PATH is unset), so there is nowhere to write this highlight." },
      { status: 503 },
    )
  }
  if (!cfg.hasDatabase) {
    return NextResponse.json(
      { ok: false, error: "No DATABASE_URL is configured, so highlights cannot be saved." },
      { status: 503 },
    )
  }

  const source = await getSource(body.sourceId)
  if (!source) return NextResponse.json({ ok: false, error: "No such source." }, { status: 404 })

  const store = getStore()
  const result = await appendCapture(
    store,
    {
      url: source.url,
      title: source.title,
      author: source.author ?? undefined,
      selection: body.selection,
      prefix: body.prefix,
      suffix: body.suffix,
      note: body.note,
      color: body.color,
    },
    newId("cap"),
  )
  invalidateIndex()

  const highlight = await insertHighlight({
    sourceId: source.id,
    text: body.selection.trim(),
    prefix: body.prefix ?? "",
    suffix: body.suffix ?? "",
    positionHint: body.positionHint ?? null,
    color: body.color ?? "yellow",
    note: body.note?.trim() || null,
    inboxAnchor: result.anchor,
  })

  if (!source.inboxPath) await setSourceInboxPath(source.id, result.path)
  if (source.status === "unread") await setSourceStatus(source.id, "reading")

  return NextResponse.json({ ok: true, highlight, inboxPath: result.path })
}
