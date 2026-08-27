export type SourceStatus = "unread" | "reading" | "ready" | "processing" | "processed" | "archived"
export type HighlightColor = "yellow" | "green" | "blue" | "pink"

export interface Source {
  id: string
  url: string
  title: string
  author: string | null
  site: string | null
  sourceType: string
  savedAt: string
  readAt: string | null
  status: SourceStatus
  inboxPath: string | null
  favicon: string | null
  readerHtmlKey: string | null
  wordCount: number | null
  tags: string[]
  highlightCount?: number
  /** Highlights that have a reaction attached — the ones worth extracting from (§8). */
  reactedCount?: number
}

export interface Highlight {
  id: string
  sourceId: string
  text: string
  prefix: string
  suffix: string
  positionHint: number | null
  color: HighlightColor
  note: string | null
  createdAt: string
  inboxAnchor: string | null
}

export interface ProposalLink {
  target: string
  relation: string
  exists: boolean
}

export interface MocUpdate {
  file: string
  section: string
  removeTodo?: string
  addLink: string
}

export interface ProposedNote {
  action: "create" | "enrich"
  title: string
  folder: string
  tags: string[]
  markdown: string
  links: ProposalLink[]
  mocUpdate?: MocUpdate
  sourceAttribution?: { url: string; title: string }
  rationale: string
  confidence: number
  usedHighlights: string[]
  /** Set by the server, never by the model: no highlight it drew on had a reaction (§8, Q5). */
  noReaction?: boolean
}

export interface UnusedHighlight {
  highlight: string
  reason: string
}

export interface ProposalSet {
  notes: ProposedNote[]
  unused: UnusedHighlight[]
}

export interface Proposal {
  id: string
  sourceId: string
  runId: string
  action: string
  payload: ProposedNote
  rationale: string | null
  confidence: number | null
  status: "pending" | "accepted" | "rejected" | "edited"
  decidedAt: string | null
  resultingNotePath: string | null
  createdAt: string
}

export interface CapturePayload {
  url: string
  title?: string
  author?: string
  site?: string
  selection?: string
  prefix?: string
  suffix?: string
  positionHint?: number
  note?: string
  color?: HighlightColor
  captured_at?: string
  favicon?: string
}
