"use client"
import { useState, useMemo } from "react"
import type { BacklogItem } from "@/lib/related"

export function BacklogList({ items, highlight }: { items: BacklogItem[]; highlight?: string }) {
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<"all" | "todo" | "unresolved">("all")

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items
      .filter((i) => (kind === "all" ? true : i.kind === kind))
      .filter((i) => (needle ? i.text.toLowerCase().includes(needle) : true))
      .sort((a, b) => {
        if (highlight) {
          if (a.text === highlight) return -1
          if (b.text === highlight) return 1
        }
        return (b.refs ?? 0) - (a.refs ?? 0) || a.text.localeCompare(b.text)
      })
  }, [items, q, kind, highlight])

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter the backlog…"
          style={{ flex: 1, minWidth: 180 }}
        />
        <div className="filters" style={{ padding: 0, border: "none" }}>
          {(["all", "todo", "unresolved"] as const).map((k) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div>
      </div>

      <div style={{ border: "0.5px solid var(--line)", borderRadius: 4, overflow: "hidden" }}>
        {shown.length === 0 && <div className="empty">Nothing matches.</div>}
        {shown.map((item, i) => (
          <div
            key={`${item.kind}-${item.text}-${item.source}-${i}`}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "9px 13px",
              borderTop: i === 0 ? "none" : "0.5px solid var(--line)",
              background: item.text === highlight ? "var(--warn-soft)" : undefined,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{item.text}</div>
              <div className="meta" style={{ marginTop: 2 }}>
                {item.kind === "todo"
                  ? `${item.source}${item.section ? ` · ${item.section}` : ""}`
                  : `${item.refs} link${item.refs === 1 ? "" : "s"} point here · first in ${item.source}`}
              </div>
            </div>
            <span className={`pill ${item.kind === "unresolved" ? "warn" : ""}`}>{item.kind}</span>
            <a
              className="btn sm"
              href={`https://www.google.com/search?q=${encodeURIComponent(item.text)}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Start research →
            </a>
          </div>
        ))}
      </div>
    </>
  )
}
