/**
 * marginalia — MV3 service worker.
 *
 * The one rule this file exists to enforce: never lose a capture because the
 * server was down. Everything is queued to chrome.storage.local first and
 * flushed on a timer, on browser startup, and immediately after each capture.
 * The badge shows how many are still waiting.
 */

const QUEUE_KEY = "queue"
const DEFAULTS = { endpoint: "http://localhost:3117", secret: "" }

async function settings() {
  const s = await chrome.storage.local.get(["endpoint", "secret"])
  return { ...DEFAULTS, ...s }
}

async function getQueue() {
  const { [QUEUE_KEY]: q } = await chrome.storage.local.get(QUEUE_KEY)
  return Array.isArray(q) ? q : []
}

async function setQueue(q) {
  await chrome.storage.local.set({ [QUEUE_KEY]: q })
  await chrome.action.setBadgeText({ text: q.length ? String(q.length) : "" })
  await chrome.action.setBadgeBackgroundColor({ color: "#9a6a00" })
}

/** Queue first, then try to flush. The capture is durable before the network. */
export async function enqueue(payload) {
  const q = await getQueue()
  q.push({ ...payload, queued_at: new Date().toISOString() })
  await setQueue(q)
  return flush()
}

async function flush() {
  const q = await getQueue()
  if (!q.length) return { sent: 0, remaining: 0 }

  const { endpoint, secret } = await settings()
  if (!secret) {
    return { sent: 0, remaining: q.length, error: "No capture secret set. Open the extension options." }
  }

  let sent = 0
  const remaining = []
  for (const item of q) {
    try {
      const res = await fetch(`${endpoint}/api/capture`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-marginalia-secret": secret },
        body: JSON.stringify(item),
      })
      if (res.ok) {
        sent++
        continue
      }
      if (res.status === 401) {
        // A bad secret will never succeed on retry; surface it rather than
        // spinning forever, but keep the capture.
        remaining.push(item)
        const body = await res.json().catch(() => ({}))
        await setQueue(remaining.concat(q.slice(q.indexOf(item) + 1)))
        return { sent, remaining: remaining.length, error: body.error ?? "Rejected: bad capture secret." }
      }
      remaining.push(item)
    } catch {
      // Server down. Keep everything still unsent and try again later.
      remaining.push(item)
    }
  }
  await setQueue(remaining)
  return { sent, remaining: remaining.length }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-link",
    title: "Save this link to your brain",
    contexts: ["link"],
  })
  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save selection to your brain",
    contexts: ["selection"],
  })
  chrome.alarms.create("flush", { periodInMinutes: 0.5 })
  void setQueue([])
})

chrome.runtime.onStartup.addListener(() => {
  void flush()
})

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "flush") void flush()
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "save-link" && info.linkUrl) {
    await enqueue({ url: info.linkUrl, title: info.linkUrl, captured_at: new Date().toISOString() })
    await toast(tab, "Link saved to read later")
  }
  if (info.menuItemId === "save-selection" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "capture-selection", focusNote: true })
  }
})

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return
  if (command === "save-selection") {
    // Speed is the entire point: the shortcut opens the popover with the
    // reaction field already focused, so the whole interaction is type + Enter.
    chrome.tabs.sendMessage(tab.id, { type: "capture-selection", focusNote: true })
  }
  if (command === "save-page") {
    await savePage(tab)
  }
})

chrome.action.onClicked.addListener(async (tab) => {
  await savePage(tab)
})

async function savePage(tab) {
  if (!tab?.id || !tab.url?.startsWith("http")) return
  let meta = { author: null, description: null, favicon: null }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        author:
          document.querySelector('meta[name="author"]')?.content ??
          document.querySelector('meta[property="article:author"]')?.content ??
          null,
        description: document.querySelector('meta[name="description"]')?.content ?? null,
        favicon: document.querySelector('link[rel~="icon"]')?.href ?? null,
      }),
    })
    meta = result ?? meta
  } catch {
    /* a restricted page; the url and title are still worth saving */
  }
  await enqueue({
    url: tab.url,
    title: tab.title ?? tab.url,
    author: meta.author,
    site: new URL(tab.url).hostname,
    favicon: meta.favicon,
    captured_at: new Date().toISOString(),
  })
  await toast(tab, "Saved to read later")
}

async function toast(tab, text) {
  if (!tab?.id) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toast", text })
  } catch {
    /* no content script on this page */
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "capture") {
    enqueue(msg.payload).then(sendResponse)
    return true
  }
  if (msg.type === "flush") {
    flush().then(sendResponse)
    return true
  }
  if (msg.type === "status") {
    Promise.all([getQueue(), settings()]).then(([q, s]) =>
      sendResponse({ queued: q.length, endpoint: s.endpoint, configured: Boolean(s.secret) }),
    )
    return true
  }
  return false
})
