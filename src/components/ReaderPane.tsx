"use client"
import { useEffect, useState, useCallback } from "react"
import { Reader } from "./Reader"
import type { Source, Highlight, HighlightColor } from "@/lib/types"
import { useRouter } from "next/navigation"

interface ReaderState {
  loading: boolean
  ok: boolean
  html?: string
  title?: string
  byline?: string | null
  siteName?: string | null
  wordCount?: number
  message?: string
  reason?: string
  cached?: boolean
  stale?: boolean
  demo?: boolean
}

/** §6.4. Failure is expected and handled explicitly, never as a broken page. */
export function ReaderPane({
  source,
  highlights,
  canCapture,
  captureDisabledReason,
}: {
  source: Source
  highlights: Highlight[]
  canCapture: boolean
  captureDisabledReason: string | null
}) {
  const [state, setState] = useState<ReaderState>({ loading: true, ok: false })
  const [unanchored, setUnanchored] = useState<string[]>([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState("")
  const router = useRouter()

  const load = useCallback(async (refresh = false) => {
    setState({ loading: true, ok: false })
    try {
      const res = await fetch(`/api/reader?sourceId=${encodeURIComponent(source.id)}${refresh ? "&refresh=1" : ""}`)
      const data = await res.json()
      setState({ loading: false, ...data })
    } catch (e) {
      setState({ loading: false, ok: false, reason: "fetch-failed", message: (e as Error).message })
    }
  }, [source.id])

  useEffect(() => {
    void load()
  }, [load])

  const submitPaste = async () => {
    const res = await fetch("/api/reader", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceId: source.id, url: source.url, text: pasted }),
    })
    const data = await res.json()
    setState({ loading: false, ...data })
    setPasteOpen(false)
  }

  const onCapture = async (sel: { text: string; prefix: string; suffix: string; positionHint: number; note: string; color: HighlightColor }) => {
    const res = await fetch("/api/highlights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceId: source.id,
        url: source.url,
        title: source.title,
        selection: sel.text,
        prefix: sel.prefix,
        suffix: sel.suffix,
        positionHint: sel.positionHint,
        note: sel.note,
        color: sel.color,
      }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error ?? "Could not save the highlight.")
    router.refresh()
  }

  const unanchoredHighlights = highlights.filter((h) => unanchored.includes(h.id))

  return (
    <div className="reader">
      <div className="meta" style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <a href={source.url} target="_blank" rel="noreferrer noopener">
          {state.siteName ?? source.site ?? source.url}
        </a>
        {state.cached && <span className="pill">cached</span>}
        {state.demo && <span className="pill warn">demo article</span>}
        {state.stale && <span className="pill warn">source unreachable — served from cache</span>}
      </div>

      <h1 className="reader-title">{state.title ?? source.title}</h1>
      <div className="reader-byline meta">
        {state.byline ?? source.author ?? "Unknown author"}
        {state.wordCount ? ` · ${state.wordCount.toLocaleString()} words` : ""}
        {highlights.length ? ` · ${highlights.length} highlight${highlights.length === 1 ? "" : "s"}` : ""}
      </div>

      {captureDisabledReason && (
        <div className="notice warn" style={{ marginBottom: 20 }}>
          {captureDisabledReason}
        </div>
      )}

      {state.loading && <div className="empty">Fetching and extracting the article…</div>}

      {!state.loading && !state.ok && (
        <div className="notice warn" style={{ marginBottom: 22 }}>
          <b>This page did not extract.</b> {state.message}
          <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
            <a className="btn sm" href={source.url} target="_blank" rel="noreferrer noopener">
              Open in Chrome and use the extension
            </a>
            <button className="btn sm" onClick={() => setPasteOpen((v) => !v)}>
              Paste the text manually
            </button>
            <button className="btn sm" onClick={() => void load(true)}>Retry</button>
          </div>
          {pasteOpen && (
            <div style={{ marginTop: 12 }}>
              <textarea
                rows={9}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Paste the article text here. It is cached against this source, so your highlights survive even after the page goes dead."
              />
              <button className="btn sm primary" style={{ marginTop: 8 }} onClick={submitPaste} disabled={!pasted.trim()}>
                Use this text
              </button>
            </div>
          )}
        </div>
      )}

      {state.ok && state.html && (
        <Reader
          html={state.html}
          highlights={highlights}
          canCapture={canCapture}
          onCapture={canCapture ? onCapture : undefined}
          onUnanchored={setUnanchored}
        />
      )}

      {unanchoredHighlights.length > 0 && (
        <div style={{ marginTop: 34 }}>
          <div className="section-label" style={{ padding: "0 0 8px" }}>
            Highlights that no longer anchor · {unanchoredHighlights.length}
          </div>
          <div className="notice" style={{ marginBottom: 12 }}>
            The page changed since these were saved, so they could not be placed in the text. They are
            kept here in full — a highlight is never thrown away because it failed to anchor.
          </div>
          {unanchoredHighlights.map((h) => (
            <div key={h.id} className={`evidence ${h.color}`}>
              <div className="quoted">“{h.text}”</div>
              {h.note && (
                <div className="react">
                  <b>My note</b>
                  {h.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
