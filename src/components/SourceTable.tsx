import Link from "next/link"
import type { Source } from "@/lib/types"
import { StatusPill, shortDate } from "./SourceBits"

/** Each row: title, site, saved date, highlight count, status (§6.3). */
export function SourceTable({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return (
      <div className="empty">
        No sources yet. Save one with the Chrome extension, or POST a url to <code>/api/sources</code>.
      </div>
    )
  }
  return (
    <div style={{ border: "0.5px solid var(--line)", borderRadius: 4, overflow: "hidden" }}>
      {sources.map((s, i) => {
        const hl = s.highlightCount ?? 0
        const reacted = s.reactedCount ?? 0
        return (
          <Link
            key={s.id}
            href={`/source/${s.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: 14,
              alignItems: "center",
              padding: "11px 14px",
              borderTop: i === 0 ? "none" : "0.5px solid var(--line)",
              color: "inherit",
            }}
            className="source-table-row"
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500 }}>{s.title}</div>
              <div className="m" style={{ marginTop: 3, display: "flex", gap: 7, flexWrap: "wrap" }}>
                <span className="meta">{s.site ?? ""}</span>
                <span className="dot-sep">·</span>
                <span className="meta">saved {shortDate(s.savedAt)}</span>
                {hl > 0 && (
                  <>
                    <span className="dot-sep">·</span>
                    <span className="meta">
                      {hl} highlight{hl === 1 ? "" : "s"}
                      {reacted < hl && (
                        <span style={{ color: "var(--warn)" }}> · {hl - reacted} with no reaction</span>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
            <StatusPill status={s.status} />
          </Link>
        )
      })}
    </div>
  )
}
