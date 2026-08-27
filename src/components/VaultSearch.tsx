"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"

interface Hit { path: string; title: string; folder: string; excerpt: string }

/** FlexSearch over titles and bodies, with a Cmd+K palette (§6.7). */
export function VaultSearch() {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        ref.current?.focus()
        ref.current?.select()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setHits(data.hits ?? [])
      } catch {
        setHits([])
      }
    }, 130)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <input
        ref={ref}
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the vault…  ⌘K"
        aria-label="Search the vault"
      />
      {hits.length > 0 && (
        <div style={{ border: "0.5px solid var(--line)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
          {hits.map((h) => (
            <Link key={h.path} href={`/vault/note/${encodeURIComponent(h.path)}`} className="related-item">
              <div className="related-head">
                <span className="related-title">{h.title}</span>
                <span className="sim">{h.folder}</span>
              </div>
              {h.excerpt && <div className="related-excerpt">{h.excerpt}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
