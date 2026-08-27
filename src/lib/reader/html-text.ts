/**
 * Plain text from HTML — the coordinate space highlight offsets live in.
 *
 * Deliberately dependency-free, and in its own module so that importing it does
 * not drag jsdom in. This runs on every source page view to feed the
 * related-notes panel, and jsdom cannot even be *loaded* in the Vercel Node
 * runtime: jsdom@30 pulls html-encoding-sniffer, which require()s an ESM-only
 * @exodus/bytes and throws ERR_REQUIRE_ESM at import time. A top-level jsdom
 * import took the whole page module down with it, so /source/[id] returned 500
 * — including for a source that does not exist, which should have been a 404.
 *
 * Getting text out of already-sanitised HTML needs nothing a DOM provides.
 */
export function htmlToText(html: string): string {
  return (
    html
      // Drop script/style bodies entirely.
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      // Block-level boundaries become newlines so paragraph structure survives.
      .replace(/<\/?(p|div|h[1-6]|li|blockquote|pre|tr|figcaption|section|article)\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_m, d) => safeCodePoint(Number(d)))
      .replace(/&#x([0-9a-f]+);/gi, (_m, h) => safeCodePoint(parseInt(h, 16)))
      // &amp; last, so "&amp;lt;" does not become "<".
      .replace(/&amp;/gi, "&")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  )
}

function safeCodePoint(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return ""
  try {
    return String.fromCodePoint(n)
  } catch {
    return ""
  }
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length
}
