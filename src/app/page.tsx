import { listSources } from "@/lib/db/repo"
import { getConfig } from "@/lib/config"
import { getIndex } from "@/lib/vault/index"
import { SourceRail } from "@/components/SourceRail"
import { SourceTable } from "@/components/SourceTable"
import { CapabilityNotice } from "@/components/CapabilityNotice"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function Home() {
  const cfg = getConfig()
  const [sources, index] = await Promise.all([listSources(), getIndex()])

  const ready = sources.filter((s) => s.status === "ready" || s.status === "processing").length
  const highlights = sources.reduce((a, s) => a + (s.highlightCount ?? 0), 0)
  const bare = sources.reduce((a, s) => a + ((s.highlightCount ?? 0) - (s.reactedCount ?? 0)), 0)

  return (
    <div className="shell">
      <aside className="rail">
        <SourceRail sources={sources} />
      </aside>

      <main className="center">
        <div className="pad" style={{ maxWidth: "56rem" }}>
          <h1 style={{ fontSize: 24, letterSpacing: "-0.02em", marginBottom: 6 }}>Sources</h1>
          <p className="meta" style={{ marginBottom: 18 }}>
            {sources.length} saved · {highlights} highlights{bare > 0 ? ` · ${bare} with no reaction` : ""} ·{" "}
            {ready} ready to process · vault has {index.notes.size} notes
          </p>

          <CapabilityNotice />

          <SourceTable sources={sources} />

          <div style={{ marginTop: 26 }} className="notice">
            <b>How the loop works.</b> Highlight in Chrome with the extension, or open a saved
            source here and highlight in the reader. Highlights accumulate against one source and
            one inbox file. When a source is ready, run extraction and review each proposed note
            before anything is written. <Link href="/backlog">The backlog</Link> closes the other
            direction: it turns a gap you noticed into something you are reading about.
          </div>
        </div>
      </main>

      <aside className="aside">
        <div className="section-label">Vault</div>
        <div style={{ padding: "0 14px 14px" }}>
          <div className="meta" style={{ lineHeight: 1.9 }}>
            {index.notes.size} notes<br />
            {index.folders.length} folders<br />
            {index.unresolvedTargets.size} unresolved links<br />
            {index.tagCounts.size} tags
          </div>
          {index.collisions.length > 0 && (
            <div className="notice danger" style={{ marginTop: 12 }}>
              <b>Basename collision.</b> {index.collisions.join(", ")} — every wikilink to these is
              ambiguous in Quartz and Obsidian. Rename one of each pair.
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Link className="btn sm" href="/vault">Browse the vault</Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
