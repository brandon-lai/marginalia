import { NextResponse } from "next/server"
import { listSources, upsertSource } from "@/lib/db/repo"
import { getConfig } from "@/lib/config"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true, sources: await listSources(), demo: !getConfig().hasDatabase })
}

/** Save a link for later without reading it now (§6.2 "save page"). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: string; title?: string } | null
  if (!body?.url) return NextResponse.json({ ok: false, error: "url is required." }, { status: 400 })
  if (!getConfig().hasDatabase) {
    return NextResponse.json(
      { ok: false, error: "No DATABASE_URL is configured, so the read-later queue is read-only here." },
      { status: 503 },
    )
  }
  try {
    const source = await upsertSource({
      url: body.url,
      title: body.title ?? body.url,
      site: new URL(body.url).hostname,
    })
    return NextResponse.json({ ok: true, source })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
