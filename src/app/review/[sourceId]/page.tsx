import { notFound } from "next/navigation"
import Link from "next/link"
import { getSource, listHighlights, latestProposals } from "@/lib/db/repo"
import { getIndex, subjectFolders } from "@/lib/vault/index"
import { getConfig } from "@/lib/config"
import { ReviewGate } from "@/components/ReviewGate"

export const dynamic = "force-dynamic"

export default async function ReviewPage({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params
  const cfg = getConfig()
  const [source, highlights, index, existing] = await Promise.all([
    getSource(sourceId),
    listHighlights(sourceId),
    getIndex(),
    latestProposals(sourceId),
  ])
  if (!source) notFound()

  const folders = subjectFolders(index).map((f) => f.folder)
  const existingTitles = [...index.byBasename.keys()]

  return (
    <main className="center" style={{ maxWidth: "76rem", margin: "0 auto", width: "100%" }}>
      <div className="pad">
        <div style={{ marginBottom: 4 }}>
          <Link href={`/source/${source.id}`} className="meta">← back to the reader</Link>
        </div>
        <h1 style={{ fontSize: 24, letterSpacing: "-0.02em", marginBottom: 5 }}>Review</h1>
        <p className="meta" style={{ marginBottom: 18 }}>
          {source.title} · {highlights.length} highlight{highlights.length === 1 ? "" : "s"} ·{" "}
          {highlights.filter((h) => h.note?.trim()).length} with a reaction
        </p>

        <div className="notice" style={{ marginBottom: 20 }}>
          <b>Nothing below this line touches disk until you accept it.</b> Each proposal is written,
          filed, linked and its MOC edit computed — but none of it is applied. Accept writes the note,
          updates the MOC and index.md, and commits. Reject keeps the row as a record of what you chose
          not to keep.
        </div>

        <ReviewGate
          source={source}
          highlights={highlights}
          initialProposals={existing.map((p) => p.payload)}
          folders={folders}
          existingTitles={existingTitles}
          canWrite={cfg.canWrite}
          hasAnthropic={cfg.hasAnthropic}
        />
      </div>
    </main>
  )
}
