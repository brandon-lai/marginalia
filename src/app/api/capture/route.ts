import { NextResponse } from "next/server"
import { checkCaptureSecret, corsHeaders } from "@/lib/auth"
import { getConfig } from "@/lib/config"
import { getStore, invalidateIndex } from "@/lib/vault/index"
import { appendCapture } from "@/lib/vault/inbox"
import { upsertSource, insertHighlight, setSourceInboxPath, setSourceStatus, getSourceByUrl } from "@/lib/db/repo"
import { newId } from "@/lib/db/client"
import type { CapturePayload } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

/**
 * The extension's endpoint. The inbox file is written FIRST and the database
 * second: if Supabase is unreachable the material is still in the vault and
 * /process-inbox still works on it (PRD §4.1). The reverse order would make the
 * database a single point of loss for something the user just wrote.
 */
export async function POST(req: Request) {
  const auth = checkCaptureSecret(req)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason }, { status: 401, headers: corsHeaders() })
  }

  const cfg = getConfig()
  let payload: CapturePayload
  try {
    payload = (await req.json()) as CapturePayload
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400, headers: corsHeaders() })
  }

  if (!payload.url || !/^https?:\/\//i.test(payload.url)) {
    return NextResponse.json(
      { ok: false, error: "A capture needs an http(s) url." },
      { status: 400, headers: corsHeaders() },
    )
  }

  if (!cfg.canWrite) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This instance has no vault configured (BRAIN_PATH is unset), so there is nowhere to write the " +
          "capture. Run marginalia locally against your vault to capture.",
      },
      { status: 503, headers: corsHeaders() },
    )
  }

  const hasSelection = Boolean(payload.selection?.trim() || payload.note?.trim())
  const captureId = newId("cap")
  const store = getStore()

  let inboxPath: string | null = null
  try {
    // §4.2: a saved link with no highlight does not get an inbox file. It lives
    // only in the database until the first highlight or note is attached,
    // otherwise the inbox fills with unread bookmarks.
    if (hasSelection) {
      const result = await appendCapture(store, payload, captureId)
      inboxPath = result.path
      invalidateIndex()
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Could not write the inbox file: ${(e as Error).message}` },
      { status: 500, headers: corsHeaders() },
    )
  }

  // Database second, and its failure does not fail the request — the capture is
  // already safe on disk.
  let sourceId: string | null = null
  let dbError: string | null = null
  if (cfg.hasDatabase) {
    try {
      const source = await upsertSource({
        url: payload.url,
        title: payload.title ?? payload.url,
        author: payload.author ?? null,
        site: payload.site ?? hostOf(payload.url),
        favicon: payload.favicon ?? null,
      })
      sourceId = source.id
      if (inboxPath) await setSourceInboxPath(source.id, inboxPath)
      if (hasSelection && payload.selection?.trim()) {
        await insertHighlight({
          sourceId: source.id,
          text: payload.selection.trim(),
          prefix: payload.prefix ?? "",
          suffix: payload.suffix ?? "",
          positionHint: payload.positionHint ?? null,
          color: payload.color ?? "yellow",
          note: payload.note?.trim() || null,
        })
        if (source.status === "unread") await setSourceStatus(source.id, "reading")
      }
    } catch (e) {
      dbError = (e as Error).message
      console.error("[marginalia] capture saved to disk but not to the database:", e)
    }
  }

  const existing = cfg.hasDatabase && !sourceId ? await getSourceByUrl(payload.url).catch(() => null) : null

  return NextResponse.json(
    {
      ok: true,
      captureId,
      inboxPath,
      sourceId: sourceId ?? existing?.id ?? null,
      savedToVault: Boolean(inboxPath),
      savedToDatabase: Boolean(sourceId),
      warning: dbError
        ? `Saved to the vault, but the database write failed: ${dbError}`
        : !cfg.hasDatabase && hasSelection
          ? "Saved to the vault. No DATABASE_URL is configured, so this capture will not appear in the sources library."
          : null,
    },
    { headers: corsHeaders() },
  )
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}
