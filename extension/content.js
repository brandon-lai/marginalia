/**
 * marginalia content script — the selection popover.
 *
 * The reaction field is the centre of this UI, not decoration. It takes focus
 * the moment the popover opens and its placeholder asks the question directly,
 * because a highlight with a reaction is raw material and a highlight without
 * one is a bookmark. Everything the extraction step can do well depends on this
 * field being used.
 */

const MIN_SELECTION = 10
const COLORS = ["yellow", "green", "blue", "pink"]

let popover = null
let currentSelection = null

function textOf(sel) {
  return sel.toString().replace(/\s+/g, " ").trim()
}

/** 32 characters either side, plus the offset into the page text. */
function contextFor(range) {
  const body = document.body
  const full = body.innerText ?? body.textContent ?? ""
  let positionHint = 0
  try {
    const before = document.createRange()
    before.selectNodeContents(body)
    before.setEnd(range.startContainer, range.startOffset)
    positionHint = before.toString().replace(/\s+/g, " ").length
  } catch {
    positionHint = 0
  }
  const flat = full.replace(/\s+/g, " ")
  const text = range.toString().replace(/\s+/g, " ").trim()
  const at = flat.indexOf(text)
  const idx = at === -1 ? positionHint : at
  return {
    prefix: flat.slice(Math.max(0, idx - 32), idx),
    suffix: flat.slice(idx + text.length, idx + text.length + 32),
    positionHint: idx,
  }
}

function metaAuthor() {
  return (
    document.querySelector('meta[name="author"]')?.content ??
    document.querySelector('meta[property="article:author"]')?.content ??
    null
  )
}

function removePopover() {
  popover?.remove()
  popover = null
}

function showPopover(range, { focusNote }) {
  removePopover()
  const rect = range.getBoundingClientRect()

  const host = document.createElement("div")
  host.className = "marginalia-host"
  // A shadow root so the host page's CSS cannot reach in and break the popover.
  const root = host.attachShadow({ mode: "open" })

  const style = document.createElement("style")
  style.textContent = POPOVER_CSS
  root.appendChild(style)

  const box = document.createElement("div")
  box.className = "mg-popover"
  box.innerHTML = `
    <input class="mg-note" type="text" placeholder="Why does this matter?" aria-label="Why does this matter?">
    <div class="mg-row">
      <div class="mg-swatches">
        ${COLORS.map(
          (c, i) =>
            `<button class="mg-swatch mg-${c}" data-color="${c}" aria-label="${c}" aria-pressed="${i === 0}"></button>`,
        ).join("")}
      </div>
      <button class="mg-save">Save to brain</button>
    </div>
    <div class="mg-hint">No reaction yet — this saves as a bookmark.</div>
    <div class="mg-status" hidden></div>
  `
  root.appendChild(box)
  document.body.appendChild(host)

  const top = window.scrollY + rect.bottom + 8
  const left = Math.max(8, Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 312))
  host.style.cssText = `position:absolute;top:${top}px;left:${left}px;z-index:2147483647;`

  const noteInput = root.querySelector(".mg-note")
  const hint = root.querySelector(".mg-hint")
  const status = root.querySelector(".mg-status")
  let color = "yellow"

  root.querySelectorAll(".mg-swatch").forEach((b) => {
    b.addEventListener("click", () => {
      color = b.dataset.color
      root.querySelectorAll(".mg-swatch").forEach((x) => x.setAttribute("aria-pressed", String(x === b)))
    })
  })

  noteInput.addEventListener("input", () => {
    hint.hidden = Boolean(noteInput.value.trim())
  })

  const save = async () => {
    status.hidden = false
    status.textContent = "Saving…"
    status.className = "mg-status"
    const ctx = contextFor(range)
    const payload = {
      url: location.href,
      title: document.title,
      author: metaAuthor(),
      site: location.hostname,
      selection: textOf(range),
      prefix: ctx.prefix,
      suffix: ctx.suffix,
      positionHint: ctx.positionHint,
      note: noteInput.value.trim(),
      color,
      captured_at: new Date().toISOString(),
    }
    const res = await chrome.runtime.sendMessage({ type: "capture", payload })
    if (res?.error) {
      status.textContent = res.error
      status.className = "mg-status mg-err"
      return
    }
    // Visual state: the selection stays highlighted for the rest of the session.
    paint(range, color)
    if (res?.remaining) {
      status.textContent = `Queued — the app is not reachable. ${res.remaining} waiting.`
      status.className = "mg-status mg-warn"
      setTimeout(removePopover, 1800)
    } else {
      removePopover()
    }
  }

  root.querySelector(".mg-save").addEventListener("click", save)
  noteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save()
    if (e.key === "Escape") removePopover()
  })

  if (focusNote) noteInput.focus()
  currentSelection = range
}

/** Wrap the selection so it stays visibly highlighted for the session. */
function paint(range, color) {
  try {
    const mark = document.createElement("mark")
    mark.className = `marginalia-hl marginalia-${color}`
    range.surroundContents(mark)
  } catch {
    // Crosses element boundaries; not worth breaking the page over.
  }
}

document.addEventListener("mouseup", (e) => {
  if (e.target?.closest?.(".marginalia-host")) return
  setTimeout(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      removePopover()
      return
    }
    if (textOf(sel).length < MIN_SELECTION) return
    showPopover(sel.getRangeAt(0), { focusNote: false })
  }, 10)
})

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") removePopover()
})

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg.type === "capture-selection") {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && textOf(sel).length >= MIN_SELECTION) {
      showPopover(sel.getRangeAt(0), { focusNote: true })
    } else {
      showToast("Select at least 10 characters first")
    }
    sendResponse({ ok: true })
  }
  if (msg.type === "toast") {
    showToast(msg.text)
    sendResponse({ ok: true })
  }
  return true
})

function showToast(text) {
  const host = document.createElement("div")
  const root = host.attachShadow({ mode: "open" })
  root.innerHTML = `<style>${TOAST_CSS}</style><div class="mg-toast">${text}</div>`
  host.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;"
  document.body.appendChild(host)
  setTimeout(() => host.remove(), 2400)
}

const POPOVER_CSS = `
  :host { all: initial; }
  .mg-popover {
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    width: 296px; padding: 9px 10px;
    background: #fff; color: #2b2b2b;
    border: 0.5px solid #d2d2d2; border-radius: 6px;
    box-shadow: 0 6px 22px rgba(0,0,0,.16), 0 1px 3px rgba(0,0,0,.1);
  }
  @media (prefers-color-scheme: dark) {
    .mg-popover { background: #1d1d20; color: #ebebec; border-color: #4a464a; }
    .mg-note { background: #161618; color: #ebebec; border-color: #4a464a; }
  }
  .mg-note {
    width: 100%; box-sizing: border-box; padding: 6px 9px; margin-bottom: 8px;
    border: 0.5px solid #d2d2d2; border-radius: 4px; font: inherit;
    background: #fff; color: inherit;
  }
  .mg-note:focus { outline: 2px solid #284b63; outline-offset: -1px; }
  .mg-row { display: flex; align-items: center; gap: 8px; }
  .mg-swatches { display: flex; gap: 5px; }
  .mg-swatch {
    width: 17px; height: 17px; border-radius: 50%; cursor: pointer;
    border: 0.5px solid #d2d2d2; padding: 0;
  }
  .mg-swatch[aria-pressed="true"] { outline: 2px solid #284b63; outline-offset: 1px; }
  .mg-yellow { background: #fff236; } .mg-green { background: #a8e6a3; }
  .mg-blue { background: #a3d5ff; } .mg-pink { background: #ffb3d1; }
  .mg-save {
    margin-left: auto; padding: 4px 10px; border-radius: 4px; cursor: pointer;
    background: #284b63; color: #fff; border: 0.5px solid #284b63; font: inherit;
  }
  .mg-hint, .mg-status {
    font-size: 11px; margin-top: 7px; color: #7a7a7a;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .mg-warn { color: #9a6a00; } .mg-err { color: #a13d3d; }
`

const TOAST_CSS = `
  .mg-toast {
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #2b2b2b; color: #faf8f8;
    padding: 8px 13px; border-radius: 5px;
    box-shadow: 0 6px 22px rgba(0,0,0,.22);
  }
`
