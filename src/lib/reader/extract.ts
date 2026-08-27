import "server-only"
import { JSDOM } from "jsdom"
import { Readability } from "@mozilla/readability"
import createDOMPurify from "dompurify"

/**
 * Server-side article extraction (PRD §6.4). Failure is expected and must be
 * handled well — paywalls, SPAs and login walls all return nothing useful, and
 * the UI offers "open in Chrome and use the extension" or "paste the text
 * manually" rather than showing a broken page.
 */

export interface ExtractedArticle {
  ok: true
  title: string
  byline: string | null
  siteName: string | null
  html: string
  text: string
  wordCount: number
  excerpt: string | null
}

export interface ExtractionFailure {
  ok: false
  reason: "fetch-failed" | "not-html" | "no-article" | "too-short" | "blocked"
  message: string
  status?: number
}

export type ExtractionResult = ExtractedArticle | ExtractionFailure

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

export async function fetchAndExtract(url: string, timeoutMs = 15_000): Promise<ExtractionResult> {
  let res: Response
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    })
  } catch (e) {
    return { ok: false, reason: "fetch-failed", message: `Could not fetch the page: ${(e as Error).message}` }
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const blocked = res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429
    return {
      ok: false,
      reason: blocked ? "blocked" : "fetch-failed",
      status: res.status,
      message: blocked
        ? `The site refused the request (${res.status}). This is usually a paywall or a login wall.`
        : `The site returned ${res.status}.`,
    }
  }

  const contentType = res.headers.get("content-type") ?? ""
  if (!/text\/html|application\/xhtml/.test(contentType)) {
    return {
      ok: false,
      reason: "not-html",
      message: `That URL is ${contentType.split(";")[0] || "not HTML"}. PDFs and video pages are not readable in v1.`,
    }
  }

  const raw = await res.text()
  return extractFromHtml(raw, url)
}

export function extractFromHtml(raw: string, url: string): ExtractionResult {
  let dom: JSDOM
  try {
    dom = new JSDOM(raw, { url })
  } catch (e) {
    return { ok: false, reason: "no-article", message: `Could not parse the page: ${(e as Error).message}` }
  }

  const doc = dom.window.document
  const siteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ?? null

  const article = new Readability(doc, { charThreshold: 250 }).parse()
  if (!article?.content) {
    return {
      ok: false,
      reason: "no-article",
      message:
        "Readability found no article here. That usually means a paywall, a login wall, or a JavaScript-rendered page.",
    }
  }

  const purify = createDOMPurify(new JSDOM("").window as unknown as Window & typeof globalThis)
  const html = purify.sanitize(article.content, {
    ALLOWED_TAGS: [
      "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "em", "strong", "i", "b",
      "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
      "br", "hr", "span", "div", "sup", "sub", "cite", "small",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "srcset", "colspan", "rowspan"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
  })

  const text = htmlToText(html)
  const wordCount = (text.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length

  if (wordCount < 60) {
    return {
      ok: false,
      reason: "too-short",
      message: `Only ${wordCount} words were extracted. The real content is probably behind a paywall or rendered by JavaScript.`,
    }
  }

  return {
    ok: true,
    title: article.title ?? url,
    byline: article.byline ?? null,
    siteName: siteName ?? new URL(url).hostname,
    html,
    text,
    wordCount,
    excerpt: article.excerpt ?? null,
  }
}

/** Plain text of the article, the coordinate space highlight offsets live in. */
export function htmlToText(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`)
  const body = dom.window.document.body
  for (const el of body.querySelectorAll("script,style")) el.remove()
  // Block elements become newlines so paragraph boundaries survive.
  for (const el of body.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,figcaption,br")) {
    el.insertAdjacentText("beforeend", "\n")
  }
  return (body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim()
}
