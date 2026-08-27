"use client"
import { useEffect, useRef, useState } from "react"
import type { HighlightColor } from "@/lib/types"

export interface PendingSelection {
  text: string
  prefix: string
  suffix: string
  positionHint: number
  rect: { top: number; left: number; bottom: number; width: number }
}

const COLORS: { key: HighlightColor; label: string }[] = [
  { key: "yellow", label: "Yellow" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
  { key: "pink", label: "Pink" },
]

/**
 * Rule 1: the reaction field is the popover's centre. It takes focus
 * immediately and its placeholder asks the question directly, because §8 —
 * the whole voice argument — depends on this field actually being used.
 * A highlight with a reaction is raw material; one without is a bookmark.
 */
export function CapturePopover({
  selection,
  onSave,
  onCancel,
}: {
  selection: PendingSelection
  onSave: (note: string, color: HighlightColor) => Promise<void>
  onCancel: () => void
}) {
  const [note, setNote] = useState("")
  const [color, setColor] = useState<HighlightColor>("yellow")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onCancel])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(note, color)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  // Keep the popover on screen near the selection.
  const top = selection.rect.bottom + 8
  const left = Math.max(12, Math.min(selection.rect.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 308))

  return (
    <div className="popover" style={{ position: "absolute", top, left, zIndex: 60 }} role="dialog" aria-label="Save highlight">
      <input
        ref={inputRef}
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !saving) void save()
        }}
        placeholder="Why does this matter?"
        aria-label="Why does this matter?"
        style={{ marginBottom: 8 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c.key}
              className="swatch"
              aria-pressed={color === c.key}
              aria-label={c.label}
              title={c.label}
              onClick={() => setColor(c.key)}
              style={{ background: `var(--hl-${c.key})` }}
            />
          ))}
        </div>
        <button className="btn sm primary" style={{ marginLeft: "auto" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save to brain"}
        </button>
        <button className="btn sm" onClick={onCancel} disabled={saving}>
          Esc
        </button>
      </div>
      {!note.trim() && (
        <div className="meta" style={{ marginTop: 7, lineHeight: 1.45 }}>
          No reaction yet — this saves as a bookmark, and extraction will mark it low confidence.
        </div>
      )}
      {error && (
        <div className="notice danger" style={{ marginTop: 8, padding: "7px 9px", fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  )
}
