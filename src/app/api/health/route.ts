import { NextResponse } from "next/server"
import { getConfig } from "@/lib/config"
import { getIndex } from "@/lib/vault/index"

export const dynamic = "force-dynamic"

export async function GET() {
  const cfg = getConfig()
  let notes = 0
  let collisions: string[] = []
  try {
    const index = await getIndex()
    notes = index.notes.size
    collisions = index.collisions
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  return NextResponse.json({
    ok: true,
    mode: cfg.hasVault ? "vault" : "demo",
    vault: { notes, collisions, root: cfg.hasVault ? cfg.brainPath : "demo-vault/brain" },
    capabilities: {
      vault: cfg.hasVault,
      database: cfg.hasDatabase,
      extraction: cfg.hasAnthropic,
      capture: Boolean(cfg.captureSecret),
      writes: cfg.canWrite,
    },
  })
}
