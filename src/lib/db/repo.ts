import { db, hasDatabase, newId, NoDatabaseError } from "./client"
import { DEMO_SOURCES, DEMO_HIGHLIGHTS, DEMO_PROPOSALS } from "./demo-data"
import type { Source, Highlight, Proposal, ProposedNote, SourceStatus, HighlightColor } from "../types"

/**
 * Every read falls back to the demo dataset when no database is configured.
 * Every write throws NoDatabaseError instead — a deployed demo must never look
 * like it saved something it did not.
 */

function requireDb() {
  if (!hasDatabase()) throw new NoDatabaseError()
  return db()
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

function toSource(r: Row): Source {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    author: r.author ?? null,
    site: r.site ?? null,
    sourceType: r.source_type,
    savedAt: new Date(r.saved_at).toISOString(),
    readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
    status: r.status,
    inboxPath: r.inbox_path ?? null,
    favicon: r.favicon ?? null,
    readerHtmlKey: r.reader_html_key ?? null,
    wordCount: r.word_count ?? null,
    tags: r.tags ?? [],
    highlightCount: r.highlight_count != null ? Number(r.highlight_count) : undefined,
    reactedCount: r.reacted_count != null ? Number(r.reacted_count) : undefined,
  }
}

function toHighlight(r: Row): Highlight {
  return {
    id: r.id,
    sourceId: r.source_id,
    text: r.text,
    prefix: r.prefix ?? "",
    suffix: r.suffix ?? "",
    positionHint: r.position_hint ?? null,
    color: r.color,
    note: r.note ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    inboxAnchor: r.inbox_anchor ?? null,
  }
}

function demoCounts(s: Source): Source {
  const hs = DEMO_HIGHLIGHTS.filter((h) => h.sourceId === s.id)
  return { ...s, highlightCount: hs.length, reactedCount: hs.filter((h) => h.note?.trim()).length }
}

export async function listSources(): Promise<Source[]> {
  if (!hasDatabase()) {
    return DEMO_SOURCES.map(demoCounts).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
  }
  const sql = db()
  const rows = await sql`
    select s.*,
           count(h.id)                                          as highlight_count,
           count(h.id) filter (where coalesce(h.note,'') <> '')  as reacted_count
      from sources s
      left join highlights h on h.source_id = s.id
     group by s.id
     order by s.saved_at desc`
  return rows.map(toSource)
}

export async function getSource(id: string): Promise<Source | null> {
  if (!hasDatabase()) {
    const s = DEMO_SOURCES.find((x) => x.id === id)
    return s ? demoCounts(s) : null
  }
  const sql = db()
  const rows = await sql`
    select s.*,
           count(h.id)                                          as highlight_count,
           count(h.id) filter (where coalesce(h.note,'') <> '')  as reacted_count
      from sources s
      left join highlights h on h.source_id = s.id
     where s.id = ${id}
     group by s.id`
  return rows.length ? toSource(rows[0]) : null
}

export async function getSourceByUrl(url: string): Promise<Source | null> {
  if (!hasDatabase()) {
    const s = DEMO_SOURCES.find((x) => x.url === url)
    return s ? demoCounts(s) : null
  }
  const sql = db()
  const rows = await sql`select * from sources where url = ${url}`
  return rows.length ? toSource(rows[0]) : null
}

export async function listHighlights(sourceId: string): Promise<Highlight[]> {
  if (!hasDatabase()) {
    return DEMO_HIGHLIGHTS.filter((h) => h.sourceId === sourceId).sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : 1,
    )
  }
  const sql = db()
  const rows = await sql`select * from highlights where source_id = ${sourceId} order by created_at asc`
  return rows.map(toHighlight)
}

export async function upsertSource(input: {
  url: string
  title: string
  author?: string | null
  site?: string | null
  favicon?: string | null
  sourceType?: string
  status?: SourceStatus
}): Promise<Source> {
  const sql = requireDb()
  const existing = await sql`select * from sources where url = ${input.url}`
  if (existing.length) {
    const row = existing[0]
    const rows = await sql`
      update sources set
        title  = coalesce(nullif(${input.title}, ''), title),
        author = coalesce(${input.author ?? null}, author),
        site   = coalesce(${input.site ?? null}, site),
        favicon= coalesce(${input.favicon ?? null}, favicon)
      where id = ${row.id} returning *`
    return toSource(rows[0])
  }
  const id = newId("src")
  const rows = await sql`
    insert into sources (id, url, title, author, site, favicon, source_type, status)
    values (${id}, ${input.url}, ${input.title}, ${input.author ?? null}, ${input.site ?? null},
            ${input.favicon ?? null}, ${input.sourceType ?? "article"}, ${input.status ?? "unread"})
    returning *`
  return toSource(rows[0])
}

export async function insertHighlight(input: {
  sourceId: string
  text: string
  prefix?: string
  suffix?: string
  positionHint?: number | null
  color?: HighlightColor
  note?: string | null
  inboxAnchor?: string | null
}): Promise<Highlight> {
  const sql = requireDb()
  const id = newId("hl")
  const rows = await sql`
    insert into highlights (id, source_id, text, prefix, suffix, position_hint, color, note, inbox_anchor)
    values (${id}, ${input.sourceId}, ${input.text}, ${input.prefix ?? ""}, ${input.suffix ?? ""},
            ${input.positionHint ?? null}, ${input.color ?? "yellow"}, ${input.note ?? null},
            ${input.inboxAnchor ?? null})
    returning *`
  return toHighlight(rows[0])
}

export async function setSourceStatus(id: string, status: SourceStatus): Promise<void> {
  const sql = requireDb()
  await sql`update sources set status = ${status},
              read_at = case when ${status} in ('reading','ready','processed')
                             then coalesce(read_at, now()) else read_at end
            where id = ${id}`
}

export async function setSourceInboxPath(id: string, inboxPath: string): Promise<void> {
  const sql = requireDb()
  await sql`update sources set inbox_path = ${inboxPath} where id = ${id}`
}

export async function setReaderCache(id: string, key: string, wordCount: number | null): Promise<void> {
  const sql = requireDb()
  await sql`update sources set reader_html_key = ${key}, word_count = ${wordCount} where id = ${id}`
}

/* ---------- proposals ---------- */

function toProposal(r: Row): Proposal {
  return {
    id: r.id,
    sourceId: r.source_id,
    runId: r.run_id,
    action: r.action,
    payload: r.payload as ProposedNote,
    rationale: r.rationale ?? null,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    status: r.status,
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    resultingNotePath: r.resulting_note_path ?? null,
    createdAt: new Date(r.created_at).toISOString(),
  }
}

export async function latestProposals(sourceId: string): Promise<Proposal[]> {
  if (!hasDatabase()) return DEMO_PROPOSALS.filter((p) => p.sourceId === sourceId)
  const sql = db()
  const runs = await sql`
    select run_id from proposals where source_id = ${sourceId}
    order by created_at desc limit 1`
  if (!runs.length) return []
  const rows = await sql`
    select * from proposals where source_id = ${sourceId} and run_id = ${runs[0].run_id}
    order by (payload->>'confidence')::real desc nulls last, created_at asc`
  return rows.map(toProposal)
}

export async function saveProposals(
  sourceId: string,
  runId: string,
  notes: ProposedNote[],
): Promise<Proposal[]> {
  const sql = requireDb()
  const out: Proposal[] = []
  for (const n of notes) {
    const id = newId("prop")
    const rows = await sql`
      insert into proposals (id, source_id, run_id, action, payload, rationale, confidence, status)
      values (${id}, ${sourceId}, ${runId}, ${n.action}, ${sql.json(n as never)},
              ${n.rationale}, ${n.confidence}, 'pending')
      returning *`
    out.push(toProposal(rows[0]))
  }
  return out
}

export async function getProposal(id: string): Promise<Proposal | null> {
  if (!hasDatabase()) return DEMO_PROPOSALS.find((p) => p.id === id) ?? null
  const sql = db()
  const rows = await sql`select * from proposals where id = ${id}`
  return rows.length ? toProposal(rows[0]) : null
}

export async function decideProposal(
  id: string,
  status: "accepted" | "rejected" | "edited",
  payload?: ProposedNote,
  resultingNotePath?: string,
): Promise<void> {
  const sql = requireDb()
  if (payload) {
    await sql`update proposals set status = ${status}, decided_at = now(),
                payload = ${sql.json(payload as never)},
                resulting_note_path = ${resultingNotePath ?? null}
              where id = ${id}`
  } else {
    await sql`update proposals set status = ${status}, decided_at = now(),
                resulting_note_path = ${resultingNotePath ?? null}
              where id = ${id}`
  }
}

/* ---------- note_index (derived cache, safe to truncate) ---------- */

export async function rebuildNoteIndex(
  notes: { path: string; title: string; folder: string; slug: string; type: string; tags: string[]; contentHash: string; createdAt?: string; updatedAt?: string }[],
): Promise<number> {
  const sql = requireDb()
  await sql`truncate note_index`
  if (!notes.length) return 0
  const rows = notes.map((n) => ({
    path: n.path, title: n.title, folder: n.folder, slug: n.slug, type: n.type,
    tags: n.tags, content_hash: n.contentHash,
    created_at: n.createdAt ?? null, updated_at: n.updatedAt ?? null,
  }))
  for (let i = 0; i < rows.length; i += 200) {
    await sql`insert into note_index ${sql(rows.slice(i, i + 200))}`
  }
  return rows.length
}
