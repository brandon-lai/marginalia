import { notFound } from "next/navigation"
import Link from "next/link"
import { getSource, listSources, listHighlights } from "@/lib/db/repo"
import { getIndex } from "@/lib/vault/index"
import { relatedNotes, matchingBacklog } from "@/lib/related"
import { getConfig } from "@/lib/config"
import { SourceRail } from "@/components/SourceRail"
import { ReaderPane } from "@/components/ReaderPane"
import { RelatedPanel } from "@/components/RelatedPanel"
import { DEMO_READER } from "@/lib/db/demo-data"
import { readCache } from "@/lib/reader/cache"
import { htmlToText } from "@/lib/reader/extract"

export const dynamic = "force-dynamic"

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cfg = getConfig()
  const [source, sources, highlights, index] = await Promise.all([
    getSource(id),
    listSources(),
    listHighlights(id),
    getIndex(),
  ])
  if (!source) notFound()

  // Prefer whatever article text we already have, so the related panel is
  // populated on first paint rather than after a fetch.
  let articleText: string | null = null
  if (source.readerHtmlKey) {
    const demo = DEMO_READER[source.readerHtmlKey]
    if (demo) articleText = htmlToText(demo.html)
    else {
      const cached = await readCache(source.readerHtmlKey)
      if (cached) articleText = cached.text ?? htmlToText(cached.html)
    }
  }

  const material = [
    source.title,
    ...highlights.map((h) => `${h.text} ${h.note ?? ""}`),
    articleText ?? "",
  ].join("\n")

  const related = relatedNotes(index, material, { limit: 8 }).map((r) => ({
    path: r.note.path,
    title: r.note.title,
    folder: r.note.folder,
    similarity: r.similarity,
    excerpt: r.excerpt,
    reasons: r.reasons,
  }))
  const todoMatches = matchingBacklog(index, material)

  return (
    <div className="shell">
      <aside className="rail">
        <SourceRail sources={sources} activeId={source.id} />
      </aside>

      <main className="center">
        <ReaderPane
          source={source}
          highlights={highlights}
          canCapture={cfg.canWrite && cfg.hasDatabase}
          captureDisabledReason={
            !cfg.hasVault
              ? "This instance has no vault configured, so nothing can be written. Highlighting is read-only here."
              : !cfg.hasDatabase
                ? "No DATABASE_URL is configured, so new highlights cannot be saved."
                : null
          }
        />
      </main>

      <aside className="aside">
        {/* The primary action sits at the top: the panel below it scrolls, and
            burying "extract" under eight related notes hides the whole point. */}
        <div className="aside-action">
          {highlights.length > 0 ? (
            <Link className="btn primary" href={`/review/${source.id}`} style={{ width: "100%", justifyContent: "center" }}>
              Extract &amp; review · {highlights.length} highlight{highlights.length === 1 ? "" : "s"} →
            </Link>
          ) : (
            <div className="meta" style={{ lineHeight: 1.6 }}>
              Highlight something to make this source extractable. Extraction runs on highlights,
              never on the whole article.
            </div>
          )}
        </div>
        <RelatedPanel related={related} todoMatches={todoMatches} />
      </aside>
    </div>
  )
}
