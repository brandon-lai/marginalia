import { createHmac, timingSafeEqual } from "node:crypto"
import { getConfig } from "./config"

/**
 * The capture endpoint listens on localhost, and any web page in the browser can
 * fetch localhost. So it takes a shared secret, generated on first launch and
 * pasted into the extension options once. OAuth for a single-user local app
 * would be theatre; an unauthenticated write endpoint would be a hole.
 */
export function checkCaptureSecret(req: Request): { ok: true } | { ok: false; reason: string } {
  const cfg = getConfig()
  if (!cfg.captureSecret) {
    return {
      ok: false,
      reason:
        "CAPTURE_SECRET is not set on the server. Generate one (openssl rand -hex 32), " +
        "put it in .env.local, and paste the same value into the extension options.",
    }
  }
  const presented = req.headers.get("x-marginalia-secret") ?? ""
  if (!presented) return { ok: false, reason: "Missing x-marginalia-secret header." }

  const a = createHmac("sha256", "marginalia").update(presented).digest()
  const b = createHmac("sha256", "marginalia").update(cfg.captureSecret).digest()
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Bad capture secret." }
  }
  return { ok: true }
}

/** CORS for the extension: it posts from arbitrary page origins. */
export function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-marginalia-secret",
    "access-control-max-age": "86400",
  }
}
