import { NextResponse } from "next/server"
import { plan, commitNote, validate, reconcileInbox } from "@/lib/commit"
import { getConfig } from "@/lib/config"
import { decideProposal, getSource, listHighlights, setSourceStatus } from "@/lib/db/repo"
import type { ProposedNote } from "@/lib/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/** POST /api/commit?dry=1 — the plan the review screen renders. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        note?: ProposedNote
        proposalId?: string
        sourceId?: string
        push?: boolean
        dryRun?: boolean
        subjectDescription?: string
        allConsumed?: boolean
      }
    | null

  if (!body?.note) return NextResponse.json({ ok: false, error: "note is required." }, { status: 400 })

  if (body.dryRun) {
    return NextResponse.json({ ok: true, plan: await plan(body.note) })
  }

  const cfg = getConfig()
  if (!cfg.canWrite) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This instance has no vault configured (BRAIN_PATH is unset), so it cannot write notes. " +
          "Nothing was written. Run marginalia locally against your vault to accept proposals.",
      },
      { status: 503 },
    )
  }

  const errors = await validate(body.note)
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" "), errors }, { status: 422 })

  let result
  try {
    result = await commitNote(body.note, {
      push: body.push ?? true,
      subjectDescription: body.subjectDescription,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }

  if (cfg.hasDatabase && body.proposalId) {
    await decideProposal(body.proposalId, "accepted", body.note, result.notePath).catch(() => {})
  }

  // Step 5: the inbox file is deleted only when every highlight in it has been
  // used or explicitly discarded.
  let inbox: string | null = null
  if (body.sourceId) {
    const source = await getSource(body.sourceId).catch(() => null)
    if (source?.inboxPath) {
      const highlights = await listHighlights(source.id).catch(() => [])
      const used = new Set(body.note.usedHighlights)
      const allConsumed = body.allConsumed ?? highlights.every((h) => used.has(h.id))
      inbox = await reconcileInbox(source.inboxPath, [], allConsumed).catch(() => null)
      if (allConsumed && cfg.hasDatabase) await setSourceStatus(source.id, "processed").catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, ...result, inbox })
}
