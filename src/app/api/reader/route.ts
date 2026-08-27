import { NextResponse } from "next/server"
import { fetchAndExtract, extractFromHtml } from "@/lib/reader/extract"
import { getSource, setReaderCache } from "@/lib/db/repo"
import { getConfig } from "@/lib/config"
import { DEMO_READER } from "@/lib/db/demo-data"
import { readCache, writeCache } from "@/lib/reader/cache"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * GET /api/reader?url=… or ?sourceId=…
 *
 * Sources go dead. Highlights should not, so an extracted article is cached and
 * served from the cache forever after (PRD §6.4).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get("sourceId")
  const refresh = searchParams.get("refresh") === "1"
  let url = searchParams.get("url")

  let cacheKey: string | null = null

  if (sourceId) {
    const source = await getSource(sourceId)
    if (!source) return NextResponse.json({ ok: false, reason: "no-article", message: "No such source." }, { status: 404 })
    url = source.url
    cacheKey = source.readerHtmlKey ?? `src:${source.id}`

    // Demo sources carry pre-extracted article text so the reader works with no
    // network access at all.
    const demo = source.readerHtmlKey ? DEMO_READER[source.readerHtmlKey] : undefined
    if (demo) {
      return NextResponse.json({
        ok: true, title: demo.title, byline: demo.byline, siteName: "example.com",
        html: demo.html, wordCount: countWords(demo.html), cached: true, demo: true,
      })
    }
  }

  if (!url) {
    return NextResponse.json({ ok: false, reason: "no-article", message: "Pass ?url= or ?sourceId=." }, { status: 400 })
  }

  if (!refresh && cacheKey) {
    const cached = await readCache(cacheKey)
    if (cached) return NextResponse.json({ ...cached, cached: true })
  }

  const result = await fetchAndExtract(url)
  if (!result.ok) {
    // Fall back to any cache we have — a dead source is exactly when the cache
    // earns its keep.
    if (cacheKey) {
      const cached = await readCache(cacheKey)
      if (cached) {
        return NextResponse.json({ ...cached, cached: true, stale: true, liveFetchError: result.message })
      }
    }
    return NextResponse.json(result, { status: 200 })
  }

  const body = {
    ok: true as const,
    title: result.title,
    byline: result.byline,
    siteName: result.siteName,
    html: result.html,
    text: result.text,
    wordCount: result.wordCount,
  }

  if (cacheKey) {
    await writeCache(cacheKey, body)
    if (sourceId && getConfig().hasDatabase) {
      await setReaderCache(sourceId, cacheKey, result.wordCount).catch(() => {})
    }
  }

  return NextResponse.json({ ...body, cached: false })
}

/**
 * POST /api/reader — the "paste the text manually" path for pages Readability
 * cannot reach (§6.4). Accepts raw HTML or plain text.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: string; html?: string; text?: string; sourceId?: string } | null
  if (!body?.html && !body?.text) {
    return NextResponse.json({ ok: false, message: "Send html or text." }, { status: 400 })
  }
  const url = body.url ?? "about:pasted"

  const result = body.html
    ? extractFromHtml(body.html, url)
    : ({
        ok: true as const,
        title: "Pasted text",
        byline: null,
        siteName: null,
        html: body.text!.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join("\n"),
        text: body.text!,
        wordCount: (body.text!.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length,
        excerpt: null,
      })

  if (result.ok && body.sourceId) {
    const key = `src:${body.sourceId}`
    await writeCache(key, result)
    if (getConfig().hasDatabase) await setReaderCache(body.sourceId, key, result.wordCount).catch(() => {})
  }
  return NextResponse.json(result)
}

function countWords(html: string): number {
  return (html.replace(/<[^>]+>/g, " ").match(/[\p{L}\p{N}'’-]+/gu) ?? []).length
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
