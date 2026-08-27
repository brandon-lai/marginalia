import Link from "next/link"
import type { BacklogItem } from "@/lib/related"

export interface RelatedRow {
  path: string
  title: string
  folder: string
  similarity: number
  excerpt: string
  reasons: string[]
}

/**
 * §6.5 — the "am I about to write something I already have?" check, and the
 * thing that makes this a learning tool rather than a clipping tool.
 *
 * Similarity is on an absolute scale, not normalised against the best hit: a
 * panel whose top row always reads 99% tells the reader nothing, and a top score
 * of 34% is itself the useful signal that this is a gap worth writing.
 */
export function RelatedPanel({
  related,
  todoMatches,
}: {
  related: RelatedRow[]
  todoMatches: BacklogItem[]
}) {
  return (
    <>
      {todoMatches.length > 0 && (
        <>
          <div className="section-label">You wanted to learn this</div>
          {todoMatches.map((t) => (
            <div className="todo-match" key={`${t.kind}-${t.text}-${t.source}`}>
              <span className="lead">{t.kind === "todo" ? "Open todo" : "Unresolved link"}</span>
              <b>{t.text}</b>
              <div className="meta" style={{ marginTop: 3 }}>
                {t.kind === "todo"
                  ? `${t.source}${t.section ? ` · ${t.section}` : ""}`
                  : `${t.refs} link${t.refs === 1 ? "" : "s"} point here, no note exists`}
                {t.alsoIn && t.alsoIn.length > 0 && ` · also listed in ${t.alsoIn.length} other MOC${t.alsoIn.length === 1 ? "" : "s"}`}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-label">Related notes in your vault</div>
      {related.length === 0 ? (
        <div className="empty" style={{ padding: "20px 16px" }}>
          Nothing in the vault reads as related. That is usually worth noticing.
        </div>
      ) : (
        related.map((r) => (
          <Link key={r.path} href={`/vault/note/${encodeURIComponent(r.path)}`} className="related-item">
            <div className="related-head">
              <span className="related-title">{r.title}</span>
              <span className="sim">{Math.round(r.similarity * 100)}%</span>
            </div>
            <div className="simbar">
              <i style={{ width: `${Math.round(r.similarity * 100)}%` }} />
            </div>
            <div className="meta" style={{ marginTop: 4 }}>
              {r.folder}
              {r.reasons.length > 0 && ` · ${r.reasons[0]}`}
            </div>
            {r.excerpt && <div className="related-excerpt">{r.excerpt}</div>}
          </Link>
        ))
      )}
    </>
  )
}
