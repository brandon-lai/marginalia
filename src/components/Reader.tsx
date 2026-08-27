"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { anchorAll } from "@/lib/reader/anchor"
import type { Highlight, HighlightColor } from "@/lib/types"
import { CapturePopover, type PendingSelection } from "./CapturePopover"

/**
 * Renders the extracted article and re-anchors saved highlights into it.
 *
 * Anchoring runs over the live DOM text rather than the HTML string, because
 * the coordinate space that matters is what the reader can see. Highlights are
 * measured synchronously in useLayoutEffect so nothing is ever painted
 * un-highlighted for a frame.
 *
 * A highlight that will not anchor is never discarded — it is reported to the
 * parent and shown in the sidebar as an unanchored quote (PRD §4.4).
 */
export function Reader({
  html,
  highlights,
  onUnanchored,
  onCapture,
  canCapture,
}: {
  html: string
  highlights: Highlight[]
  onUnanchored?: (ids: string[]) => void
  onCapture?: (sel: PendingSelection & { note: string; color: HighlightColor }) => Promise<void>
  canCapture: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<PendingSelection | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const applyHighlights = useCallback(() => {
    const root = ref.current
    if (!root) return

    // Clear any previous decoration so re-runs are idempotent.
    for (const el of root.querySelectorAll("mark.hl")) {
      const parent = el.parentNode
      if (!parent) continue
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
      parent.normalize()
    }
    for (const el of root.querySelectorAll(".reaction")) el.remove()

    // Build the text coordinate space from the DOM's text nodes.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    const starts: number[] = []
    let text = ""
    let node: Node | null
    while ((node = walker.nextNode())) {
      const t = node as Text
      nodes.push(t)
      starts.push(text.length)
      text += t.data
    }
    if (!text) return

    const anchored = anchorAll(
      text,
      highlights.map((h) => ({
        id: h.id,
        text: h.text,
        prefix: h.prefix,
        suffix: h.suffix,
        positionHint: h.positionHint,
      })),
    )

    const unanchored: string[] = []

    // Apply longest-last so earlier wraps do not disturb later offsets: we
    // resolve every range against the untouched node list first.
    const ranges: { h: Highlight; range: Range }[] = []
    for (const a of anchored) {
      const h = highlights.find((x) => x.id === a.highlight.id)!
      if (!a.range) {
        unanchored.push(h.id)
        continue
      }
      const start = locate(nodes, starts, a.range.start)
      const end = locate(nodes, starts, a.range.end)
      if (!start || !end) {
        unanchored.push(h.id)
        continue
      }
      const r = document.createRange()
      try {
        r.setStart(start.node, start.offset)
        r.setEnd(end.node, end.offset)
        ranges.push({ h, range: r })
      } catch {
        unanchored.push(h.id)
      }
    }

    for (const { h, range } of ranges) {
      try {
        const mark = document.createElement("mark")
        mark.className = `hl ${h.color}`
        mark.dataset.hid = h.id
        // surroundContents throws when the range crosses element boundaries;
        // wrapping each intersecting text node handles the general case.
        try {
          range.surroundContents(mark)
        } catch {
          wrapAcrossNodes(range, h)
        }

        if (h.note?.trim()) {
          // Rule 2: the reaction renders directly beneath its highlight, as one
          // unit — after the block the highlight ends in.
          const anchorEl = (range.endContainer.nodeType === 3
            ? range.endContainer.parentElement
            : (range.endContainer as Element)) as Element | null
          const block = anchorEl?.closest("p,li,blockquote,h1,h2,h3,h4,pre,td,div")
          const reaction = document.createElement("aside")
          reaction.className = "reaction"
          reaction.dataset.hid = h.id
          const who = document.createElement("span")
          who.className = "who"
          who.textContent = "My note"
          reaction.append(who, document.createTextNode(h.note.trim()))
          if (block?.parentNode) block.parentNode.insertBefore(reaction, block.nextSibling)
          else root.appendChild(reaction)
        }
      } catch {
        unanchored.push(h.id)
      }
    }

    onUnanchored?.(unanchored)
  }, [html, highlights, onUnanchored])

  // Measure synchronously before paint, then observe. Waiting on the first
  // ResizeObserver callback leaves the article blank for a frame — or forever
  // in a headless browser.
  useLayoutEffect(() => {
    applyHighlights()
  }, [applyHighlights])

  // Selection -> popover. The reader uses the same popover as the extension.
  useEffect(() => {
    if (!canCapture) return
    const root = ref.current
    if (!root) return

    const onUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer)) return
      const selected = sel.toString().trim()
      if (selected.length < 10) return

      const rect = range.getBoundingClientRect()
      const { prefix, suffix, positionHint } = contextAround(root, range)
      setPending({
        text: selected,
        prefix,
        suffix,
        positionHint,
        rect: { top: rect.top + window.scrollY, left: rect.left + window.scrollX, bottom: rect.bottom + window.scrollY, width: rect.width },
      })
    }

    document.addEventListener("mouseup", onUp)
    return () => document.removeEventListener("mouseup", onUp)
  }, [canCapture, html])

  // Clicking a highlight focuses it and its reaction together.
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      const mark = (e.target as HTMLElement).closest?.("mark.hl") as HTMLElement | null
      setActiveId(mark?.dataset.hid ?? null)
    }
    root.addEventListener("click", onClick)
    return () => root.removeEventListener("click", onClick)
  }, [])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    for (const el of root.querySelectorAll("mark.hl")) {
      el.classList.toggle("active", (el as HTMLElement).dataset.hid === activeId)
    }
  }, [activeId, html, highlights])

  return (
    <>
      <div ref={ref} className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      {pending && onCapture && (
        <CapturePopover
          selection={pending}
          onCancel={() => setPending(null)}
          onSave={async (note, color) => {
            await onCapture({ ...pending, note, color })
            setPending(null)
            window.getSelection()?.removeAllRanges()
          }}
        />
      )}
    </>
  )
}

function locate(nodes: Text[], starts: number[], offset: number): { node: Text; offset: number } | null {
  let lo = 0
  let hi = nodes.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= offset) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (found === -1) return null
  const node = nodes[found]
  const local = offset - starts[found]
  if (local > node.data.length) {
    const next = nodes[found + 1]
    return next ? { node: next, offset: 0 } : { node, offset: node.data.length }
  }
  return { node, offset: local }
}

/** Wrap a range that crosses element boundaries, one text node at a time. */
function wrapAcrossNodes(range: Range, h: Highlight) {
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT)
  const affected: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (range.intersectsNode(n)) affected.push(n as Text)
  }
  for (const t of affected) {
    const start = t === range.startContainer ? range.startOffset : 0
    const end = t === range.endContainer ? range.endOffset : t.data.length
    if (end <= start) continue
    const piece = t.splitText(start)
    if (end - start < piece.data.length) piece.splitText(end - start)
    const mark = document.createElement("mark")
    mark.className = `hl ${h.color}`
    mark.dataset.hid = h.id
    piece.parentNode?.insertBefore(mark, piece)
    mark.appendChild(piece)
  }
}

/** 32 characters either side, plus the offset into the article text (§4.4). */
function contextAround(root: HTMLElement, range: Range) {
  const full = root.textContent ?? ""
  const before = document.createRange()
  before.selectNodeContents(root)
  before.setEnd(range.startContainer, range.startOffset)
  const positionHint = before.toString().length
  return {
    prefix: full.slice(Math.max(0, positionHint - 32), positionHint),
    suffix: full.slice(positionHint + range.toString().length, positionHint + range.toString().length + 32),
    positionHint,
  }
}
