const $ = (id) => document.getElementById(id)

async function load() {
  const s = await chrome.storage.local.get(["endpoint", "secret"])
  $("endpoint").value = s.endpoint ?? "http://localhost:3117"
  $("secret").value = s.secret ?? ""
  const status = await chrome.runtime.sendMessage({ type: "status" })
  if (status?.queued) {
    say(`${status.queued} capture${status.queued === 1 ? "" : "s"} waiting to be sent.`, "warn")
  }
}

function say(text, cls = "") {
  $("status").textContent = text
  $("status").className = `status ${cls}`
}

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    endpoint: $("endpoint").value.trim().replace(/\/$/, ""),
    secret: $("secret").value.trim(),
  })
  say("Saved.", "ok")
})

$("test").addEventListener("click", async () => {
  const endpoint = $("endpoint").value.trim().replace(/\/$/, "")
  const secret = $("secret").value.trim()
  say("Testing…")
  try {
    const health = await fetch(`${endpoint}/api/health`).then((r) => r.json())
    // A capture with no url is rejected as a bad request when the secret is
    // right, and 401 when it is wrong — which distinguishes the two without
    // writing anything to the vault.
    const probe = await fetch(`${endpoint}/api/capture`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-marginalia-secret": secret },
      body: JSON.stringify({}),
    })
    if (probe.status === 401) {
      const body = await probe.json().catch(() => ({}))
      say(body.error ?? "The secret was rejected.", "err")
      return
    }
    const caps = health.capabilities ?? {}
    if (!caps.writes) {
      say(`Connected (${health.vault?.notes ?? 0} notes) but the app has no vault configured, so captures will be refused.`, "warn")
      return
    }
    say(`Connected. Vault has ${health.vault.notes} notes, secret accepted.`, "ok")
  } catch (e) {
    say(`Could not reach ${endpoint}. Is the app running? (${e.message})`, "err")
  }
})

$("flush").addEventListener("click", async () => {
  const res = await chrome.runtime.sendMessage({ type: "flush" })
  if (res?.error) say(res.error, "err")
  else say(`Sent ${res.sent}. ${res.remaining} still queued.`, res.remaining ? "warn" : "ok")
})

load()
