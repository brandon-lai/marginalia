import Link from "next/link"
import { getIndex } from "@/lib/vault/index"
import { backlog } from "@/lib/related"
import { BacklogList } from "@/components/BacklogList"

export const dynamic = "force-dynamic"

/**
 * §6.8 — the 110 open todos across the MOCs and the genuine unresolved
 * wikilinks, merged into one list. A small feature that closes the loop from
 * "I noticed a gap" to "I am reading about it".
 */
export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ want?: string }>
}) {
  const { want } = await searchParams
  const index = await getIndex()
  const items = backlog(index)

  const todos = items.filter((i) => i.kind === "todo")
  const unresolved = items.filter((i) => i.kind === "unresolved")

  return (
    <main className="center" style={{ maxWidth: "60rem", margin: "0 auto", width: "100%" }}>
      <div className="pad">
        <h1 style={{ fontSize: 24, letterSpacing: "-0.02em", marginBottom: 5 }}>Backlog</h1>
        <p className="meta" style={{ marginBottom: 18 }}>
          {todos.length} open todo{todos.length === 1 ? "" : "s"} across the MOCs ·{" "}
          {unresolved.length} unresolved wikilink{unresolved.length === 1 ? "" : "s"} · the two
          machine-readable records of what you wanted to learn next
        </p>

        {want && (
          <div className="notice warn" style={{ marginBottom: 18 }}>
            <b>{want}</b> does not exist yet. Links point at it, which is the vault saying you
            meant to write it. Start research below.
          </div>
        )}

        <BacklogList items={items} highlight={want} />

        <div className="notice" style={{ marginTop: 22 }}>
          Unresolved wikilinks are a feature, not a defect. They are the write-next queue, and the
          protocol&rsquo;s rule is that a topic listed as <code>- [ ]</code> gets removed from Topics To
          Explore and re-added as a live link when the note is written — which is exactly what the
          review gate does on accept.
        </div>
      </div>
    </main>
  )
}
