import "server-only"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeRaw from "rehype-raw"
import rehypeStringify from "rehype-stringify"
import { codeToHtml } from "shiki"
import type { VaultIndex } from "./vault/index"
import { resolveTarget } from "./vault/wikilink"
import { slugifyFilePath } from "./vault/slug"

/**
 * Renders vault markdown. Versions are matched to the Quartz fork's
 * package.json (remark 15 / remark-gfm 4 / unified 11) so the app and the
 * published site interpret the same file identically.
 *
 * Wikilinks are rewritten before parsing, into ordinary links pointing at the
 * app's own note routes, with a class marking whether the target resolves —
 * unresolved links are a feature, not a defect, and must look deliberate.
 */

const WIKILINK_RE = /(!?)\[\[([^\[\]\|#\\]+)?(#+[^\[\]\|#\\]+)?(\\?\|[^\[\]#]*)?\]\]/g

export function rewriteWikilinks(md: string, index: VaultIndex): string {
  return md.replace(WIKILINK_RE, (_m, bang: string, target = "", heading = "", alias = "") => {
    const t = String(target).trim()
    if (!t) return _m
    const display = alias ? String(alias).replace(/^\\?\|/, "").trim() : t
    if (bang === "!") {
      // Embeds resolve against Attachments/. v1 links out rather than inlining.
      return `<span class="embed-ref" title="Attachment embed">${escapeHtml(display)}</span>`
    }
    const resolved = resolveTarget(t, index.byBasename)
    const frag = heading ? `#${String(heading).replace(/^#+/, "").trim().replace(/\s+/g, "-").toLowerCase()}` : ""
    if (resolved) {
      return `<a class="wikilink" href="/vault/note/${encodeURIComponent(resolved)}${frag}">${escapeHtml(display)}</a>`
    }
    return `<a class="wikilink unresolved" href="/backlog?want=${encodeURIComponent(t)}" title="This note does not exist yet — a deliberate write-next prompt">${escapeHtml(display)}</a>`
  })
}

export async function renderMarkdown(md: string, index: VaultIndex): Promise<string> {
  const withLinks = rewriteWikilinks(md, index)
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(withLinks)
  return highlightCode(String(file))
}

/** Shiki over fenced blocks, using Quartz's github-light / github-dark themes. */
async function highlightCode(html: string): Promise<string> {
  const blocks = [...html.matchAll(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g)]
  if (!blocks.length) return html
  let out = html
  for (const b of blocks) {
    const lang = b[1] ?? "text"
    const code = decodeEntities(b[2])
    try {
      const rendered = await codeToHtml(code, {
        lang,
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
      })
      out = out.replace(b[0], rendered)
    } catch {
      /* unknown language: leave the plain block */
    }
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export { slugifyFilePath }
