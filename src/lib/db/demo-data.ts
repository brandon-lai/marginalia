import type { Source, Highlight, Proposal } from "../types"

/**
 * The read-only dataset the app serves with no DATABASE_URL. It exists so the
 * deployed instance is a working demonstration of the product rather than an
 * empty shell, and so the UI was built against realistic volume and text
 * lengths from the first render. Every write path refuses loudly instead of
 * pretending to persist against it.
 */

const HL = (
  id: string,
  sourceId: string,
  text: string,
  note: string | null,
  color: Highlight["color"],
  prefix: string,
  suffix: string,
  positionHint: number,
  createdAt: string,
): Highlight => ({
  id, sourceId, text, prefix, suffix, positionHint, color, note, createdAt, inboxAnchor: null,
})

export const DEMO_SOURCES: Source[] = [
  {
    id: "src_demo_tracing",
    url: "https://example.com/why-distributed-tracing-is-hard",
    title: "Why Distributed Tracing Is Hard",
    author: "Jane Doe",
    site: "example.com",
    sourceType: "article",
    savedAt: "2026-08-24T14:20:00Z",
    readAt: "2026-08-24T14:31:00Z",
    status: "ready",
    inboxPath: "Inbox/2026-08-24 Why Distributed Tracing Is Hard.md",
    favicon: null,
    readerHtmlKey: "demo:tracing",
    wordCount: 2140,
    tags: [],
  },
  {
    id: "src_demo_queues",
    url: "https://example.com/queues-are-not-magic",
    title: "Queues Are Not Magic",
    author: "Amara Osei",
    site: "example.com",
    sourceType: "article",
    savedAt: "2026-08-23T09:05:00Z",
    readAt: "2026-08-23T09:40:00Z",
    status: "ready",
    inboxPath: "Inbox/2026-08-23 Queues Are Not Magic.md",
    favicon: null,
    readerHtmlKey: "demo:queues",
    wordCount: 1680,
    tags: [],
  },
  {
    id: "src_demo_veblen",
    url: "https://example.com/status-goods-and-price",
    title: "Status Goods and the Upward-Sloping Demand Curve",
    author: "R. Whitfield",
    site: "example.com",
    sourceType: "article",
    savedAt: "2026-08-22T18:12:00Z",
    readAt: "2026-08-22T18:44:00Z",
    status: "reading",
    inboxPath: "Inbox/2026-08-22 Status Goods and the Upward-Sloping Demand Curve.md",
    favicon: null,
    readerHtmlKey: null,
    wordCount: 1320,
    tags: [],
  },
  {
    id: "src_demo_memory",
    url: "https://example.com/sleep-and-consolidation",
    title: "What Sleep Does to a Memory",
    author: null,
    site: "example.com",
    sourceType: "article",
    savedAt: "2026-08-21T21:02:00Z",
    readAt: null,
    status: "unread",
    inboxPath: null,
    favicon: null,
    readerHtmlKey: null,
    wordCount: null,
    tags: [],
  },
  {
    id: "src_demo_perspective",
    url: "https://example.com/brunelleschi-and-the-vanishing-point",
    title: "Brunelleschi and the Vanishing Point",
    author: "L. Ferrante",
    site: "example.com",
    sourceType: "article",
    savedAt: "2026-08-20T11:30:00Z",
    readAt: null,
    status: "unread",
    inboxPath: null,
    favicon: null,
    readerHtmlKey: null,
    wordCount: null,
    tags: [],
  },
  {
    id: "src_demo_idempotency",
    url: "https://example.com/exactly-once-is-a-lie",
    title: "Exactly-Once Delivery Is a Lie",
    author: "Kenji Watanabe",
    site: "example.com",
    sourceType: "article",
    savedAt: "2026-08-18T08:45:00Z",
    readAt: "2026-08-18T09:20:00Z",
    status: "processed",
    inboxPath: null,
    favicon: null,
    readerHtmlKey: "demo:idempotency",
    wordCount: 1990,
    tags: [],
  },
]

export const DEMO_HIGHLIGHTS: Highlight[] = [
  HL(
    "hl_01", "src_demo_tracing",
    "Sampling decisions made at the edge cannot be revisited once the trace has been discarded, which is why head-based sampling loses exactly the traces you most want.",
    "same tradeoff as cache eviction — you are guessing at future value at write time",
    "yellow",
    "The uncomfortable part is that ",
    " Tail-based sampling moves the decision",
    1840, "2026-08-24T14:32:11Z",
  ),
  HL(
    "hl_02", "src_demo_tracing",
    "Span context propagation across async boundaries requires explicit handoff in every runtime that lacks continuation-local storage.",
    "this is why the Node instrumentation is always the broken one",
    "green",
    "In practice the hard part is plumbing. ",
    " Thread-locals solve it in the JVM",
    4210, "2026-08-24T14:41:03Z",
  ),
  HL(
    "hl_03", "src_demo_tracing",
    "A trace without a consistent trace id across service boundaries is a collection of unrelated logs with extra steps.",
    null,
    "yellow",
    "It is worth stating plainly: ",
    " Propagation is the whole product.",
    6320, "2026-08-24T14:47:55Z",
  ),
  HL(
    "hl_04", "src_demo_queues",
    "A queue does not remove load, it moves load in time. If the consumer is slower than the producer for long enough, the queue is only a more expensive way to fail.",
    "the queue is a buffer, not a solution — the real fix is always backpressure or capacity",
    "blue",
    "The mistake people make: ",
    " Backpressure is the actual answer.",
    920, "2026-08-23T09:12:40Z",
  ),
  HL(
    "hl_05", "src_demo_queues",
    "Retries without idempotency turn a transient failure into a permanent duplicate.",
    "connects to the idempotency piece I read last week — same key, applied once",
    "yellow",
    "And the second-order effect is worse. ",
    " An idempotency key makes the retry safe.",
    3480, "2026-08-23T09:26:18Z",
  ),
  HL(
    "hl_06", "src_demo_veblen",
    "For a narrow class of goods, raising the price raises demand, because the price is the product.",
    "Veblen goods — the signal is the point, not the object",
    "pink",
    "Demand curves usually slope down. ",
    " Luxury watches are the canonical case.",
    640, "2026-08-22T18:20:05Z",
  ),
]

export const DEMO_PROPOSALS: Proposal[] = [
  {
    id: "prop_demo_1",
    sourceId: "src_demo_tracing",
    runId: "run_demo",
    action: "create",
    status: "pending",
    decidedAt: null,
    resultingNotePath: null,
    createdAt: "2026-08-24T15:02:00Z",
    confidence: 0.85,
    rationale:
      "Highlight 1 covers head-based sampling and highlight 2 covers context propagation. Kept Brandon's cache-eviction framing as the Why It Matters angle rather than writing a generic definition — that comparison is his, and it is the reason this note is worth having.",
    payload: {
      action: "create",
      title: "Distributed Tracing",
      folder: "System Design",
      tags: ["system-design"],
      markdown: [
        "# Distributed Tracing",
        "",
        "#system-design",
        "",
        "## What It Is",
        "A way to follow one request across every service it touches, by attaching a shared trace id at the edge and propagating it through every hop.",
        "",
        "## How It Works",
        "Each hop opens a span and records its parent, so the collector can rebuild the call tree afterwards. The two hard parts are both plumbing rather than theory: getting the trace id across async boundaries in runtimes with no continuation-local storage, and deciding which traces to keep. Head-based sampling decides at the edge before anything interesting has happened; tail-based sampling defers the decision until the trace is complete, at the cost of buffering everything.",
        "",
        "## Why It Matters",
        "Head-based sampling is the same tradeoff as cache eviction: you are guessing at future value at write time, and you are wrong in exactly the cases you care about. The traces worth keeping are the slow and failing ones, and those are the ones you cannot identify at the moment you must choose.",
        "",
        "## Connections",
        "- Related: [[Message Queue]]",
        "- Builds on: [[Cache]]",
        "- Related: [[Observability]]",
        "- See: [[System Design MOC]]",
        "",
        "## Source",
        "*Why Distributed Tracing Is Hard — https://example.com/why-distributed-tracing-is-hard*",
      ].join("\n"),
      links: [
        { target: "Message Queue", relation: "Related", exists: true },
        { target: "Cache", relation: "Builds on", exists: true },
        { target: "Observability", relation: "Related", exists: false },
      ],
      mocUpdate: {
        file: "Homebase/System Design MOC.md",
        section: "Intermediate Concepts",
        removeTodo: "Distributed Tracing",
        addLink: "[[Distributed Tracing]] — spans, context propagation, sampling",
      },
      sourceAttribution: {
        url: "https://example.com/why-distributed-tracing-is-hard",
        title: "Why Distributed Tracing Is Hard",
      },
      rationale:
        "Highlight 1 covers head-based sampling and highlight 2 covers context propagation. Kept Brandon's cache-eviction framing as the Why It Matters angle rather than writing a generic definition — that comparison is his, and it is the reason this note is worth having.",
      confidence: 0.85,
      usedHighlights: ["hl_01", "hl_02"],
      noReaction: false,
    },
  },
  {
    id: "prop_demo_2",
    sourceId: "src_demo_tracing",
    runId: "run_demo",
    action: "create",
    status: "pending",
    decidedAt: null,
    resultingNotePath: null,
    createdAt: "2026-08-24T15:02:00Z",
    confidence: 0.42,
    rationale:
      "Drawn from highlight 3, which has no reaction attached. There is nothing here that is not already implied by the trace-id discussion in the Distributed Tracing note, and no angle of Brandon's to build the Why It Matters section on. Low confidence: this is a bookmark, not raw material.",
    payload: {
      action: "create",
      title: "Trace Context Propagation",
      folder: "System Design",
      tags: ["system-design"],
      markdown: [
        "# Trace Context Propagation",
        "",
        "#system-design",
        "",
        "## What It Is",
        "The mechanism that carries a trace id across service boundaries so that spans recorded in different processes can be reassembled into one trace.",
        "",
        "## Why It Matters",
        "Without consistent propagation, traces are unrelated logs with extra steps.",
        "",
        "## Connections",
        "- Related: [[Distributed Tracing]]",
        "- See: [[System Design MOC]]",
        "",
        "## Source",
        "*Why Distributed Tracing Is Hard — https://example.com/why-distributed-tracing-is-hard*",
      ].join("\n"),
      links: [
        { target: "Distributed Tracing", relation: "Related", exists: false },
      ],
      sourceAttribution: {
        url: "https://example.com/why-distributed-tracing-is-hard",
        title: "Why Distributed Tracing Is Hard",
      },
      rationale:
        "Drawn from highlight 3, which has no reaction attached. There is nothing here that is not already implied by the trace-id discussion in the Distributed Tracing note, and no angle of Brandon's to build the Why It Matters section on. Low confidence: this is a bookmark, not raw material.",
      confidence: 0.42,
      usedHighlights: ["hl_03"],
      noReaction: true,
    },
  },
]

export const DEMO_UNUSED = [
  { highlight: "hl_03", reason: "Restates the trace-id point already covered in Distributed Tracing." },
]

/** Cached reader HTML for the demo sources, so the reader works with no network. */
export const DEMO_READER: Record<string, { title: string; byline: string | null; html: string }> = {
  "demo:tracing": {
    title: "Why Distributed Tracing Is Hard",
    byline: "Jane Doe",
    html: `
<p>Every team that runs more than three services eventually decides it needs tracing. Most of them get a trace id into their logs within a week, and then spend the next year discovering that this was the easy part.</p>
<h2>Sampling is a bet you place before the race</h2>
<p>You cannot keep every trace. At any real volume the storage bill and the ingestion pipeline both say no, so you sample. The question is when you decide.</p>
<p>The uncomfortable part is that Sampling decisions made at the edge cannot be revisited once the trace has been discarded, which is why head-based sampling loses exactly the traces you most want. Tail-based sampling moves the decision to the collector, after the whole trace has arrived, which means you can keep the slow ones and the failed ones — and it means buffering every trace until you know.</p>
<h2>Propagation is the whole product</h2>
<p>In practice the hard part is plumbing. Span context propagation across async boundaries requires explicit handoff in every runtime that lacks continuation-local storage. Thread-locals solve it in the JVM almost for free. In Node it is a permanent low-grade tax, and the instrumentation libraries are where most of the bugs live.</p>
<p>It is worth stating plainly: A trace without a consistent trace id across service boundaries is a collection of unrelated logs with extra steps. Propagation is the whole product. Everything else is presentation.</p>
<h2>What to do about it</h2>
<p>Start with propagation and get it right everywhere before you spend a day on dashboards. Prefer tail-based sampling if you can afford the buffer, and if you cannot, at least make the head-based decision biased toward requests that already look unusual.</p>`,
  },
  "demo:queues": {
    title: "Queues Are Not Magic",
    byline: "Amara Osei",
    html: `
<p>A queue is the first thing people reach for when a system is overloaded, and it is very often the wrong thing.</p>
<h2>Load does not disappear</h2>
<p>The mistake people make: A queue does not remove load, it moves load in time. If the consumer is slower than the producer for long enough, the queue is only a more expensive way to fail. Backpressure is the actual answer. A queue buys you time to absorb a spike; it does not buy you capacity.</p>
<h2>Retries and duplicates</h2>
<p>And the second-order effect is worse. Retries without idempotency turn a transient failure into a permanent duplicate. An idempotency key makes the retry safe, and without one every at-least-once delivery guarantee is a promise to corrupt your data eventually.</p>
<p>The useful mental model is that a queue converts a latency problem into a correctness problem, and you have to be ready to pay in the second currency.</p>`,
  },
  "demo:idempotency": {
    title: "Exactly-Once Delivery Is a Lie",
    byline: "Kenji Watanabe",
    html: `
<p>Exactly-once delivery does not exist across a network partition. What exists is at-least-once delivery plus effects that can be applied more than once without changing the outcome.</p>
<h2>The key is the contract</h2>
<p>An idempotency key turns the retry from a risk into a no-op. The receiver records the key with the result, and a second arrival returns the first result rather than doing the work again.</p>
<p>The failure everyone hits is crediting from their own pending row instead of the provider's number. If the two ever disagree, the provider is right and you have just invented money.</p>`,
  },
}
