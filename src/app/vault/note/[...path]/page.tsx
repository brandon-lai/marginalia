import { notFound } from "next/navigation"
import Link from "next/link"
import { getIndex } from "@/lib/vault/index"
import { renderMarkdown } from "@/lib/markdown"
import { publishedUrl } from "@/lib/vault/slug"
import { RELATIONS } from "@/lib/vault/wikilink"
import { getConfig } from "@/lib/config"

export const dynamic = "force-dynamic"

/**
 * §6.7 — note view with rendered markdown, backlinks, outgoing links grouped by
 * relation type, and unresolved links shown as a deliberate write-next prompt.
 * v1 is read-only; editing arbitrary notes stays in Obsidian.
 */
export default async function NotePage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const notePath = decodeURIComponent(path.join("/"))
  const index = await getIndex()
  const note = index.notes.get(notePath)
  if (!note) notFound()

  const html = await renderMarkdown(note.body, index)
  const cfg = getConfig()

  const grouped = new Map<string, { target: string; path: string }[]>()
  const seen = new Set<string>()
  for (const link of note.outgoing) {
    if (link.isEmbed) continue
    const resolved = index.byBasename.get(link.target)
    if (!resolved) continue
    const key = `${link.relation ?? "Mentioned"}|${link.target}`
    if (seen.has(key)) continue
    seen.add(key)
    const bucket = link.relation ?? "Mentioned"
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), { target: link.target, path: resolved }])
  }
  const order = [...RELATIONS, "Mentioned"]
  const groups = [...grouped.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))

  const backlinks = [...new Map(note.incoming.map((i) => [i.from, i])).values()]

  return (
    <div className="shell">
      <div className="rail">
        <div className="section-label">{note.folder || "Vault root"}</div>
        {[...index.notes.values()]
          .filter((n) => n.folder === note.folder && n.type !== "template")
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((n) => (
            <Link
              key={n.path}
              href={`/vault/note/${encodeURIComponent(n.path)}`}
              className="source-row"
              aria-current={n.path === note.path ? "true" : undefined}
            >
              <div className="t">{n.title}</div>
            </Link>
          ))}
      </div>

      <main className="center">
        <article className="reader">
          <div className="meta" style={{ marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{note.path}</span>
            <span className="dot-sep">·</span>
            <span>{note.type}</span>
            <span className="dot-sep">·</span>
            <span>{note.wordCount} words</span>
          </div>
          <h1 className="reader-title">{note.title}</h1>
          <div className="reader-byline meta" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {note.tags.map((t) => <span key={t} className="pill">#{t}</span>)}
            {note.createdAt && <span>added {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
          </div>
          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </main>

      <aside className="aside">
        <div className="section-label">Backlinks · {backlinks.length}</div>
        {backlinks.length === 0 ? (
          <div className="empty" style={{ padding: "14px 16px" }}>
            Nothing links here yet. Value comes from connections, not storage.
          </div>
        ) : (
          backlinks.map((b) => {
            const from = index.notes.get(b.from)
            return (
              <Link key={b.from} href={`/vault/note/${encodeURIComponent(b.from)}`} className="related-item">
                <div className="related-head">
                  <span className="related-title">{from?.title ?? b.from}</span>
                  {b.relation && <span className="sim">{b.relation}</span>}
                </div>
                <div className="meta" style={{ marginTop: 3 }}>{from?.folder}</div>
              </Link>
            )
          })
        )}

        {groups.length > 0 && (
          <>
            <div className="section-label">Outgoing</div>
            <div style={{ padding: "0 14px 12px" }}>
              {groups.map(([relation, links]) => (
                <div key={relation} style={{ marginBottom: 9 }}>
                  <div className="meta" style={{ marginBottom: 3 }}>{relation}</div>
                  <div className="chips">
                    {links.map((l) => (
                      <Link key={l.path} href={`/vault/note/${encodeURIComponent(l.path)}`} className="chip exists">
                        {l.target}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {note.unresolved.length > 0 && (
          <>
            <div className="section-label">Write next · {note.unresolved.length}</div>
            <div style={{ padding: "0 14px 12px" }}>
              <div className="meta" style={{ marginBottom: 6, lineHeight: 1.5 }}>
                These links point at notes that do not exist. That is deliberate — never clean them up.
              </div>
              <div className="chips">
                {note.unresolved.map((u) => (
                  <Link key={u} href={`/backlog?want=${encodeURIComponent(u)}`} className="chip new">{u}</Link>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{ padding: "6px 14px 22px" }}>
          <div className="meta" style={{ marginBottom: 6 }}>Slug</div>
          <div className="meta" style={{ wordBreak: "break-all", marginBottom: 8 }}>{note.slug}</div>
          {cfg.hasVault && (
            <a className="btn sm" href={publishedUrl(note.path)} target="_blank" rel="noreferrer noopener">
              View on the published site →
            </a>
          )}
        </div>
      </aside>
    </div>
  )
}
