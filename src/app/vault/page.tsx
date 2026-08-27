import Link from "next/link"
import { getIndex, subjectFolders, mocFor } from "@/lib/vault/index"
import { VaultSearch } from "@/components/VaultSearch"

export const dynamic = "force-dynamic"

/** §6.7 — subject grid, mirroring index.md, into MOC, into note. */
export default async function VaultPage() {
  const index = await getIndex()
  const subjects = subjectFolders(index)
  const recent = [...index.notes.values()]
    .filter((n) => n.type === "concept" || n.type === "book")
    .filter((n) => n.createdAt)
    .sort((a, b) => (a.createdAt! < b.createdAt! ? 1 : -1))
    .slice(0, 8)

  return (
    <main className="center" style={{ maxWidth: "62rem", margin: "0 auto", width: "100%" }}>
      <div className="pad">
        <h1 style={{ fontSize: 24, letterSpacing: "-0.02em", marginBottom: 5 }}>Vault</h1>
        <p className="meta" style={{ marginBottom: 18 }}>
          {index.notes.size} notes · {subjects.length} subjects · read from the files, so this is
          always current — unlike the published site, which is only as fresh as the last build.
        </p>

        <VaultSearch />

        <div className="section-label" style={{ padding: "22px 0 10px" }}>Subjects</div>
        <div className="subject-grid">
          {subjects.map((s) => {
            const moc = mocFor(index, s.folder)
            return (
              <Link
                key={s.folder}
                href={moc ? `/vault/note/${encodeURIComponent(moc.path)}` : `/vault/folder/${encodeURIComponent(s.folder)}`}
                className="subject-card"
              >
                <div className="card-title">{s.folder}</div>
                <div className="card-desc">
                  {s.count} note{s.count === 1 ? "" : "s"}
                  {moc ? ` · ${moc.title}` : " · no MOC yet"}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="section-label" style={{ padding: "26px 0 6px" }}>Recently added</div>
        <div className="note-list">
          {recent.map((n) => (
            <Link key={n.path} href={`/vault/note/${encodeURIComponent(n.path)}`}>
              <span>{n.title}</span>
              <span className="meta">{n.folder}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
