import { NextResponse } from "next/server"
import { setSourceStatus } from "@/lib/db/repo"
import { getConfig } from "@/lib/config"
import type { SourceStatus } from "@/lib/types"

export const dynamic = "force-dynamic"

const VALID: SourceStatus[] = ["unread", "reading", "ready", "processing", "processed", "archived"]

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => null)) as { status?: SourceStatus } | null
  if (!body?.status || !VALID.includes(body.status)) {
    return NextResponse.json({ ok: false, error: `status must be one of ${VALID.join(", ")}` }, { status: 400 })
  }
  if (!getConfig().hasDatabase) {
    return NextResponse.json(
      { ok: false, error: "No DATABASE_URL is configured; source status is read-only here." },
      { status: 503 },
    )
  }
  await setSourceStatus(id, body.status)
  return NextResponse.json({ ok: true })
}
