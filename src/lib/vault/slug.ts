/**
 * Quartz's slug algorithm, replicated from `quartz/util/path.ts` in the
 * brain-frontend repo (verified against v4.5.2 on 2026-08-27).
 *
 * PRD §5.5 / system guide §2.4: "Reimplement, don't guess." Any link this app
 * renders to the published site depends on producing byte-identical output,
 * including the double hyphen that `&` produces once the surrounding spaces
 * have already become hyphens.
 */

export type FullSlug = string & { __brand: "full" }
export type SimpleSlug = string & { __brand: "simple" }

function stripSlashes(s: string, onlyStripPrefix = false): string {
  if (s.startsWith("/")) s = s.substring(1)
  if (!onlyStripPrefix && s.endsWith("/")) s = s.slice(0, -1)
  return s
}

/** Quartz's `sluggify`: per-segment substitutions, order is load-bearing. */
function sluggify(s: string): string {
  return s
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
    .replace(/\/$/, "")
}

function getFileExtension(s: string): string | undefined {
  return s.match(/\.[A-Za-z0-9]+$/)?.[0]
}

function endsWith(s: string, suffix: string): boolean {
  return s === suffix || s.endsWith("/" + suffix)
}

/** Vault-relative path (e.g. "Computer Science/Linked List.md") -> Quartz FullSlug. */
export function slugifyFilePath(fp: string, excludeExt?: boolean): FullSlug {
  fp = stripSlashes(fp)
  let ext = getFileExtension(fp)
  const withoutFileExt = fp.replace(new RegExp(ext + "$"), "")
  if (excludeExt || [".md", ".html", undefined].includes(ext)) {
    ext = ""
  }

  let slug = sluggify(withoutFileExt)

  // treat _index as index
  if (endsWith(slug, "_index")) {
    slug = slug.replace(/_index$/, "index")
  }

  return (slug + (ext ?? "")) as FullSlug
}

/** Trims a trailing "index" so the vault homepage is "/". */
export function simplifySlug(fp: string): SimpleSlug {
  const res = stripSlashes(trimSuffix(fp, "index"), true)
  return (res.length === 0 ? "/" : res) as SimpleSlug
}

function trimSuffix(s: string, suffix: string): string {
  if (endsWith(s, suffix)) s = s.slice(0, -suffix.length)
  return s
}

/** The published-site URL for a vault path. */
export function publishedUrl(vaultPath: string, baseUrl = "brandons-brain.vercel.app"): string {
  return `https://${baseUrl}/${slugifyFilePath(vaultPath)}`
}
