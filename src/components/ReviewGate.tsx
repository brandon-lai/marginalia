"use client"
import { useState } from "react"
import type { Source, Highlight, ProposedNote, UnusedHighlight } from "@/lib/types"
import { ProposalCard } from "./ProposalCard"

/**
 * §6.6 step 2. The gate. Per-note accept, edit or reject; nothing is written
 * until Accept.
 *
 * Q5 is answered here: a proposal drawn only from highlights with no reaction
 * is marked, is not accept-all eligible, and carries an explanation of why it
 * is being held back rather than silently ranking low.
 */
export function ReviewGate({
  source,
  highlights,
  initialProposals,
  folders,
  existingTitles,
  canWrite,
  hasAnthropic,
}: {
  source: Source
  highlights: Highlight[]
  initialProposals: ProposedNote[]
  folders: string[]
  existingTitles: string[]
  canWrite: boolean
  hasAnthropic: boolean
}) {
  const [proposals, setProposals] = useState<ProposedNote[]>(initialProposals)
  const [unused, setUnused] = useState<UnusedHighlight[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ isDemo: boolean; titlesSent: number; claudeMdBytes: number } | null>(null)
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "rejected">>({})
  const [push, setPush] = useState(true)

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? "Extraction failed.")
      setProposals(data.notes)
      setUnused(data.unused ?? [])
      setMeta({
        isDemo: data.isDemo,
        titlesSent: data.context?.titlesSent ?? 0,
        claudeMdBytes: data.context?.claudeMdBytes ?? 0,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const pending = proposals.filter((p) => !decisions[p.title])
  const acceptAllEligible = pending.filter((p) => !p.noReaction && p.confidence >= 0.6)

  return (
    <>
      <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <button className="btn primary" onClick={run} disabled={running || !highlights.length}>
          {running ? "Extracting…" : proposals.length ? "Re-run extraction" : "Run extraction"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} style={{ width: "auto" }} />
          Push on accept
        </label>
        <span className="meta">
          {push ? "git add · commit · push — the push is the deploy" : "commit locally, do not push"}
        </span>
        {meta && (
          <span className="meta" style={{ marginLeft: "auto" }}>
            {meta.titlesSent} titles + {(meta.claudeMdBytes / 1024).toFixed(1)} KB of CLAUDE.md sent as context
          </span>
        )}
      </div>

      {!hasAnthropic && (
        <div className="notice warn" style={{ marginBottom: 20 }}>
          <b>No ANTHROPIC_API_KEY is set.</b> Extraction returns a pre-written proposal set so this
          screen can be driven end to end. It is canned, not generated — set the key to run real
          extraction against your vault.
        </div>
      )}

      {error && (
        <div className="notice danger" style={{ marginBottom: 20 }}>
          <b>Extraction failed.</b> {error}
        </div>
      )}

      {proposals.length === 0 && !running && (
        <div className="empty">
          No proposals yet. Run extraction to see what this source would add to the vault.
        </div>
      )}

      {proposals.length > 0 && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="meta">
            {proposals.length} proposal{proposals.length === 1 ? "" : "s"} ·{" "}
            {acceptAllEligible.length} eligible for accept-all ·{" "}
            {pending.filter((p) => p.noReaction).length} held back for having no reaction
          </span>
        </div>
      )}

      {proposals.map((p) => (
        <ProposalCard
          key={p.title}
          proposal={p}
          source={source}
          highlights={highlights}
          folders={folders}
          existingTitles={existingTitles}
          canWrite={canWrite}
          push={push}
          decision={decisions[p.title]}
          onDecided={(d) => setDecisions((prev) => ({ ...prev, [p.title]: d }))}
        />
      ))}

      {unused.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div className="section-label" style={{ padding: "0 0 8px" }}>
            Highlights not used · {unused.length}
          </div>
          <div className="notice" style={{ marginBottom: 12 }}>
            What got dropped, and why. If one of these should have become a note, say so — the
            reasons here are also the signal for tuning the extraction prompt.
          </div>
          {unused.map((u) => {
            const h = highlights.find((x) => x.id === u.highlight)
            return (
              <div key={u.highlight} className={`evidence ${h?.color ?? "yellow"}`} style={{ marginBottom: 12 }}>
                <div className="quoted">“{h?.text ?? u.highlight}”</div>
                {h?.note && (
                  <div className="react">
                    <b>My note</b>
                    {h.note}
                  </div>
                )}
                <div className="meta" style={{ marginTop: 6 }}>Dropped: {u.reason}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
