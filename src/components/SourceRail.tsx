"use client"
import Link from "next/link"
import { useState, useMemo } from "react"
import type { Source } from "@/lib/types"
import { StatusPill, shortDate, hostOf } from "./SourceBits"

const FILTERS = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "highlights", label: "Highlighted" },
  { key: "unread", label: "Unread" },
  { key: "processed", label: "Done" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

function matches(s: Source, f: FilterKey): boolean {
  switch (f) {
    case "ready": return s.status === "ready" || s.status === "processing"
    case "highlights": return (s.highlightCount ?? 0) > 0
    case "unread": return s.status === "unread"
    case "processed": return s.status === "processed" || s.status === "archived"
    default: return true
  }
}

/** §6.3 — the app's home screen. Ready to process is the important state. */
export function SourceRail({ sources, activeId }: { sources: Source[]; activeId?: string }) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const shown = useMemo(() => sources.filter((s) => matches(s, filter)), [sources, filter])

  const groups = useMemo(() => {
    const ready = shown.filter((s) => s.status === "ready" || s.status === "processing")
    const reading = shown.filter((s) => s.status === "reading")
    const unread = shown.filter((s) => s.status === "unread")
    const done = shown.filter((s) => s.status === "processed" || s.status === "archived")
    return [
      { label: "Ready to process", items: ready },
      { label: "Reading", items: reading },
      { label: "Unread", items: unread },
      { label: "Processed", items: done },
    ].filter((g) => g.items.length)
  }, [shown])

  return (
    <>
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {groups.length === 0 && <div className="empty">No sources match this filter.</div>}
      {groups.map((g) => (
        <div key={g.label}>
          <div className="section-label">
            {g.label} · {g.items.length}
          </div>
          {g.items.map((s) => (
            <SourceRow key={s.id} source={s} active={s.id === activeId} />
          ))}
        </div>
      ))}
    </>
  )
}

export function SourceRow({ source, active }: { source: Source; active?: boolean }) {
  const hl = source.highlightCount ?? 0
  const reacted = source.reactedCount ?? 0
  return (
    <Link href={`/source/${source.id}`} className="source-row" aria-current={active ? "true" : undefined}>
      <div className="t">{source.title}</div>
      <div className="m">
        <span className="meta">{source.site ?? hostOf(source.url)}</span>
        <span className="dot-sep">·</span>
        <span className="meta">{shortDate(source.savedAt)}</span>
        {hl > 0 && (
          <span className="meta" title={`${reacted} of ${hl} highlights have a reaction`}>
            {hl} hl{reacted < hl ? ` · ${hl - reacted} bare` : ""}
          </span>
        )}
        <StatusPill status={source.status} />
      </div>
    </Link>
  )
}
