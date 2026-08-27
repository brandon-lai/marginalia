"use client"
import { useEffect, useState, useCallback } from "react"
import type { Source, Highlight, ProposedNote, ProposalLink } from "@/lib/types"
import type { CommitPlan } from "@/lib/commit"

/**
 * One proposal, with everything needed to judge it without opening the source:
 *
 * - left, the note as it will appear on disk;
 * - right, the highlights it was drawn from (rule 3, side by side, so fidelity
 *   is checkable at a glance);
 * - the MOC edit as actual diff lines, not a description of the change (rule 4)
 *   — and the diff shown is produced by running the real edit, so it is the diff
 *   that will be applied;
 * - each link as a chip, coloured by whether the target exists (rule 5), because
 *   creating a deliberate unresolved link should be a visible choice.
 */
export function ProposalCard({
  proposal,
  source,
  highlights,
  folders,
  existingTitles,
  canWrite,
  push,
  decision,
  onDecided,
}: {
  proposal: ProposedNote
  source: Source
  highlights: Highlight[]
  folders: string[]
  existingTitles: string[]
  canWrite: boolean
  push: boolean
  decision?: "accepted" | "rejected"
  onDecided: (d: "accepted" | "rejected") => void
}) {
  const [note, setNote] = useState<ProposedNote>(proposal)
  const [editing, setEditing] = useState(false)
  const [plan, setPlan] = useState<CommitPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const loadPlan = useCallback(async (n: ProposedNote) => {
    try {
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: n, dryRun: true }),
      })
      const data = await res.json()
      if (data.ok) setPlan(data.plan)
    } catch {
      /* the card still renders without a plan */
    }
  }, [])

  useEffect(() => {
    void loadPlan(note)
  }, [note, loadPlan])

  const accept = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note, sourceId: source.id, push }),
      })
      const data = await res.json()
      if (!data.ok) {
        setResult({ ok: false, message: data.error ?? "The commit failed." })
      } else {
        setResult({
          ok: true,
          message:
            `Wrote ${data.written.join(", ")}` +
            (data.sha ? ` · committed ${String(data.sha).slice(0, 7)}` : " · not committed") +
            (data.pushed ? " · pushed" : ""),
        })
        onDecided("accepted")
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const evidence = highlights.filter((h) => note.usedHighlights.includes(h.id))
  const collides = note.action === "create" && existingTitles.includes(note.title) && note.title !== proposal.title
  const lowConfidence = note.confidence < 0.6
  const blockers = [...(plan?.errors ?? [])]

  return (
    <article className={`proposal ${lowConfidence ? "low-confidence" : ""} ${decision ? "decided" : ""}`}>
      <header className="proposal-head">
        <span className="pill">{note.action}</span>
        <span className="proposal-title">{note.title}</span>
        <span className="meta">→ {note.folder}/{note.title}.md</span>
        <span className={`confidence ${lowConfidence ? "low" : ""}`} style={{ marginLeft: "auto" }}>
          <span className="meta">{note.confidence.toFixed(2)}</span>
          <span className="bar"><i style={{ width: `${Math.round(note.confidence * 100)}%` }} /></span>
        </span>
        {decision && <span className={`pill ${decision === "accepted" ? "ready" : ""}`}>{decision}</span>}
      </header>

      <div className="proposal-body">
        <div className="proposal-left">
          {note.noReaction && (
            <div className="no-reaction-flag">
              <span aria-hidden>⚠</span>
              <span>
                <b>No reaction of yours to draw on.</b> Every highlight behind this note was saved
                without a note attached, so the framing here is the article&rsquo;s, not yours. It is held
                out of accept-all deliberately — add a reaction and re-run, or accept it knowing what
                it is.
              </span>
            </div>
          )}

          {editing ? (
            <>
              <label className="field">
                <span>Title</span>
                <input
                  type="text"
                  value={note.title}
                  onChange={(e) => setNote({ ...note, title: e.target.value })}
                />
              </label>
              {collides && (
                <div className="notice danger" style={{ marginBottom: 11 }}>
                  A note called <b>{note.title}</b> already exists. Basenames must be globally unique.
                </div>
              )}
              <label className="field">
                <span>Folder</span>
                <select value={note.folder} onChange={(e) => setNote({ ...note, folder: e.target.value })}>
                  {[...new Set([note.folder, ...folders])].filter(Boolean).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tags</span>
                <input
                  type="text"
                  value={note.tags.join(" ")}
                  onChange={(e) => setNote({ ...note, tags: e.target.value.split(/\s+/).map((t) => t.replace(/^#/, "")).filter(Boolean) })}
                />
              </label>
              <label className="field">
                <span>Markdown</span>
                <textarea
                  rows={20}
                  value={note.markdown}
                  onChange={(e) => setNote({ ...note, markdown: e.target.value })}
                />
              </label>
            </>
          ) : (
            <div className="note-preview">
              <NotePreview markdown={note.markdown} />
            </div>
          )}

          <div className="chips">
            {note.links.map((l, i) => (
              <LinkChip
                key={`${l.target}-${i}`}
                link={l}
                onRemove={() => setNote({ ...note, links: note.links.filter((_, j) => j !== i) })}
              />
            ))}
          </div>
          {note.links.some((l) => !l.exists) && (
            <div className="meta" style={{ marginTop: 2 }}>
              Amber links do not exist yet. Keeping one writes a deliberate unresolved wikilink —
              that is your write-next queue, not a mistake.
            </div>
          )}

          {note.rationale && <p className="rationale">{note.rationale}</p>}
        </div>

        <div className="proposal-right">
          <div className="section-label" style={{ padding: "0 0 8px" }}>
            Drawn from · {evidence.length} highlight{evidence.length === 1 ? "" : "s"}
          </div>
          {evidence.length === 0 && (
            <div className="meta" style={{ marginBottom: 14 }}>
              This proposal does not name the highlights it came from.
            </div>
          )}
          {evidence.map((h) => (
            <div key={h.id} className={`evidence ${h.color}`}>
              <div className="quoted">“{h.text}”</div>
              {h.note ? (
                <div className="react">
                  <b>My note</b>
                  {h.note}
                </div>
              ) : (
                <div className="meta" style={{ marginTop: 4 }}>No reaction attached.</div>
              )}
            </div>
          ))}

          <div className="section-label" style={{ padding: "6px 0 8px" }}>
            MOC edit
          </div>
          {plan?.mocPath && plan.mocDiff.length > 0 ? (
            <div className="diff">
              <div className="diff-file">{plan.mocPath}</div>
              <div className="diff-body">
                {plan.mocDiff.map((d, i) => (
                  <div key={i} className={`diff-line ${d.kind}`}>{d.text}</div>
                ))}
              </div>
            </div>
          ) : (
            <div className="meta">
              {plan ? "No MOC change is proposed for this note." : "Computing the MOC edit…"}
            </div>
          )}
          {plan && plan.mocWarnings.length > 0 && (
            <div className="notice warn" style={{ marginTop: 9, fontSize: 12 }}>
              {plan.mocWarnings.join(" ")}
            </div>
          )}

          {plan && plan.indexDiff.length > 0 && (
            <>
              <div className="section-label" style={{ padding: "12px 0 8px" }}>index.md</div>
              <div className="diff">
                <div className="diff-file">index.md · Recently Added</div>
                <div className="diff-body">
                  {plan.indexDiff.map((d, i) => (
                    <div key={i} className={`diff-line ${d.kind}`}>{d.text}</div>
                  ))}
                </div>
              </div>
            </>
          )}

          {plan?.createsSubject && (
            <div className="notice warn" style={{ marginTop: 9, fontSize: 12 }}>
              <b>New subject.</b> Accepting also creates {plan.mocPath}, appends a card to index.md&rsquo;s
              subject grid, and adds a border-color rule to quartz/styles/custom.scss.
            </div>
          )}
        </div>
      </div>

      <footer style={{ display: "flex", gap: 8, padding: "11px 15px", borderTop: "0.5px solid var(--line)", flexWrap: "wrap", alignItems: "center" }}>
        {blockers.length > 0 && (
          <div className="notice danger" style={{ width: "100%", marginBottom: 9, fontSize: 12.5 }}>
            <b>Cannot be written as-is.</b> {blockers.join(" ")}
          </div>
        )}
        {!canWrite && (
          <div className="notice warn" style={{ width: "100%", marginBottom: 9, fontSize: 12.5 }}>
            This instance has no vault configured, so Accept is disabled. Nothing here can reach disk.
          </div>
        )}
        <button
          className="btn ok"
          onClick={accept}
          disabled={busy || !canWrite || blockers.length > 0 || Boolean(decision)}
          title={!canWrite ? "No vault configured" : blockers.length ? blockers.join(" ") : undefined}
        >
          {busy ? "Writing…" : "Accept"}
        </button>
        <button className="btn" onClick={() => setEditing((v) => !v)} disabled={Boolean(decision)}>
          {editing ? "Done editing" : "Edit"}
        </button>
        <button className="btn danger" onClick={() => onDecided("rejected")} disabled={Boolean(decision)}>
          Reject
        </button>
        {result && (
          <span className={`meta`} style={{ color: result.ok ? "var(--ok)" : "var(--danger)", marginLeft: 4 }}>
            {result.message}
          </span>
        )}
      </footer>
    </article>
  )
}

function LinkChip({ link, onRemove }: { link: ProposalLink; onRemove: () => void }) {
  return (
    <span className={`chip ${link.exists ? "exists" : "new"}`} title={link.exists ? "This note exists" : "This note does not exist yet — a deliberate unresolved link"}>
      <span className="rel">{link.relation}</span>
      {link.target}
      <button onClick={onRemove} aria-label={`Remove link to ${link.target}`}>×</button>
    </span>
  )
}

/** A deliberately small markdown preview — the note as it will read on disk. */
function NotePreview({ markdown }: { markdown: string }) {
  const blocks: React.ReactNode[] = []
  const lines = markdown.split("\n")
  let para: string[] = []
  let list: string[] = []
  let table: string[] = []

  const flushPara = (k: number) => {
    if (para.length) { blocks.push(<p key={`p${k}`}>{inline(para.join(" "))}</p>); para = [] }
  }
  const flushList = (k: number) => {
    if (list.length) {
      blocks.push(<ul key={`u${k}`}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>)
      list = []
    }
  }
  const flushTable = (k: number) => {
    if (table.length >= 2) {
      const rows = table.filter((r) => !/^\s*\|?\s*[-:|\s]+\|?\s*$/.test(r)).map((r) => r.split("|").slice(1, -1).map((c) => c.trim()))
      blocks.push(
        <table key={`t${k}`}>
          <thead><tr>{rows[0]?.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      )
    }
    table = []
  }

  lines.forEach((line, i) => {
    if (/^\|/.test(line)) { flushPara(i); flushList(i); table.push(line); return }
    flushTable(i)
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushPara(i); flushList(i)
      const Tag = (`h${Math.min(h[1].length, 4)}`) as "h1" | "h2" | "h3" | "h4"
      blocks.push(<Tag key={`h${i}`}>{h[2]}</Tag>)
      return
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (li) { flushPara(i); list.push(li[1]); return }
    if (!line.trim()) { flushPara(i); flushList(i); return }
    flushList(i)
    para.push(line)
  })
  flushPara(lines.length); flushList(lines.length); flushTable(lines.length)
  return <>{blocks}</>
}

/** Wikilinks, bold, italics and inline code — enough to read the note honestly. */
function inline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index))
    if (m[1] !== undefined) out.push(<a key={k++} className="wikilink" href="#" onClick={(e) => e.preventDefault()}>{m[2] ?? m[1]}</a>)
    else if (m[3] !== undefined) out.push(<b key={k++}>{m[3]}</b>)
    else if (m[4] !== undefined) out.push(<i key={k++}>{m[4]}</i>)
    else if (m[5] !== undefined) out.push(<code key={k++}>{m[5]}</code>)
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}
