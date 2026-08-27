/**
 * Generates demo-vault/brain — a synthetic vault with the same *shape* as the
 * real one (subject folders, MOCs with Topics To Explore, typed Connections,
 * deliberate unresolved links, an index.md subject grid) but none of its
 * content. This is what the app serves when BRAIN_PATH is unset, which is what
 * makes the public deployment possible and the UI buildable against realistic
 * volume from the first render.
 *
 * Deterministic: same output every run, so screenshots and tests are stable.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "demo-vault", "brain")

// mulberry32 — small seeded PRNG so the vault is identical on every machine.
function rng(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20260827)
const pick = (a) => a[Math.floor(rand() * a.length)]
const sample = (a, n) => {
  const c = [...a]
  const out = []
  while (out.length < n && c.length) out.push(c.splice(Math.floor(rand() * c.length), 1)[0])
  return out
}

const SUBJECTS = {
  "Computer Science": {
    tag: "cs",
    desc: "Data structures, algorithms, and problem-solving patterns",
    color: "#4c7899",
    notes: [
      "Linked List", "Hashmap and Dictionary", "Binary Search Tree", "Big O", "Recursion",
      "Stack", "Array and List", "Graph Traversal", "Dynamic Programming", "Sorting Algorithms",
      "Memoization", "Two Pointer Technique", "Sliding Window",
    ],
  },
  "System Design": {
    tag: "system-design",
    desc: "How large systems are structured, scaled, and kept alive",
    color: "#7b97aa",
    notes: [
      "Cache", "Message Queue", "Load Balancing", "Database Sharding", "Idempotency",
      "Rate Limiting", "CAP Theorem", "Consistent Hashing", "Circuit Breaker",
    ],
  },
  Economics: {
    tag: "economics",
    desc: "Markets, incentives, and how value moves",
    color: "#8a7f5c",
    notes: [
      "Opportunity Cost", "Comparative Advantage", "Price Elasticity", "Public Goods",
      "Moral Hazard", "Conspicuous Consumption and Veblen Goods", "Network Effects", "Deadweight Loss",
    ],
  },
  Art: {
    tag: "art",
    desc: "Art history, movements, technique, and artists",
    color: "#9c6b6b",
    notes: [
      "Chiaroscuro", "Sfumato", "Byzantine vs. Western Depictions of Christ",
      "Donor Portraits", "Anamorphosis", "Portraiture Before Photography", "Linear Perspective",
    ],
  },
  Neuroscience: {
    tag: "neuroscience",
    desc: "Brains, signals, and why memory works the way it does",
    color: "#6b8a7a",
    notes: ["Long-Term Potentiation", "Myelination", "Neuroplasticity", "The Hippocampus", "Action Potential"],
  },
  Math: {
    tag: "math",
    desc: "Proof, structure, and the multivariable toolkit",
    color: "#77689c",
    notes: ["Green's Theorem", "Eigenvectors", "Bayes' Theorem", "Gradient and Directional Derivative", "Convexity"],
  },
  "Operating Systems": {
    tag: "operating-systems",
    desc: "Processes, memory, and what the kernel is actually doing",
    color: "#5c8a8a",
    notes: ["Processes and Threads", "Virtual Memory", "Context Switching", "Deadlock"],
  },
  Books: {
    tag: "books",
    desc: "What I read and what stayed with me",
    color: "#a08256",
    notes: ["Thinking in Systems", "The Design of Everyday Things", "Seeing Like a State"],
  },
}

// Deliberate unresolved links — invariant 8, the write-next queue.
const UNRESOLVED = [
  "Distributed Tracing", "Service Discovery", "Queue", "Epigenetics",
  "The Italian Renaissance", "Observability",
]

const RELATIONS = ["Related", "Builds on", "Enables", "Contrasts with", "Compare"]

// Openers are consumed in rotation rather than sampled, so no two notes in the
// demo vault open with the same sentence — repeated excerpts made the related
// notes panel look broken when every row read identically.
const OPENERS = [
  "The idea is simpler than the name suggests once you see what it is protecting against.",
  "This shows up everywhere once you have a word for it, which is most of the value of learning it.",
  "The mechanism is mechanical; the interesting part is when it stops being the right choice.",
  "Worth holding onto because it reframes a problem I kept solving badly by instinct.",
  "A small idea with a large blast radius across everything downstream of it.",
  "Most of the difficulty here is bookkeeping, and most of the value is in noticing that early.",
  "It answers a question I did not know I was asking until I had the vocabulary for it.",
  "The definition is short; the consequences take a while to feel in the hands.",
  "This is the thing that separates a system that bends from one that snaps.",
  "A rule that looks arbitrary until you see the failure it was written to prevent.",
  "The interesting claim is not what it does but what it refuses to promise.",
  "Once named, this turns a recurring surprise into an expected cost.",
  "The trap is treating it as a technique when it is really a constraint.",
  "Small enough to state in a sentence, large enough to reorganise a design around.",
  "What makes this stick is that the same shape shows up in three unrelated places.",
  "The useful version of this is narrower than the popular version.",
  "It is less a solution than a way of deciding which problem you would rather have.",
  "The first time this bites, it looks like a bug in something else entirely.",
]
let openerCursor = 0
const nextOpener = () => OPENERS[openerCursor++ % OPENERS.length]
const MIDDLES = [
  "The tradeoff is between doing work now and doing more work later under worse information.",
  "It works by pushing a decision to the point where the most context is available.",
  "The cost is paid in coordination; the benefit is collected in throughput.",
  "Every implementation is some answer to the question of what you are willing to lose.",
  "The failure mode is not that it breaks loudly but that it degrades in a way nobody measures.",
]
const WHY = [
  "Knowing this turns a class of surprising failures into an expected one.",
  "It is the difference between a system that bends and one that snaps.",
  "It gives a name to something I had been working around without noticing.",
  "It explains why the obvious fix usually makes the second-order problem worse.",
]

const allTitles = Object.values(SUBJECTS).flatMap((s) => s.notes)

function conceptNote(title, subject, meta, links) {
  const lines = [`# ${title}`, "", `#${meta.tag}`, "", "## What It Is", nextOpener(), ""]
  lines.push("## How It Works", pick(MIDDLES), "")
  if (rand() > 0.55) {
    lines.push("| Property | Value | Why |", "|---|---|---|")
    lines.push(`| Cost | ${pick(["O(1)", "O(log n)", "O(n)", "amortized O(1)"])} | ${pick(["the common path", "after the index is warm", "worst case only"])} |`)
    lines.push(`| Failure | ${pick(["silent", "loud", "delayed"])} | ${pick(["nothing measures it", "it fails closed", "it retries first"])} |`, "")
  }
  if (rand() > 0.7) {
    lines.push("```python", `def ${title.toLowerCase().replace(/[^a-z]+/g, "_").slice(0, 20)}(xs):`, "    return sorted(xs)", "```", "")
  }
  lines.push("## Why It Matters", pick(WHY), "")
  lines.push("## Connections")
  for (const l of links) lines.push(`- ${l.relation}: [[${l.target}]]`)
  lines.push(`- See: [[${subject === "Computer Science" ? "CS" : subject} MOC]]`, "")
  lines.push("## Source", "*Demo vault — synthetic content.*", "")
  return lines.join("\n")
}

function bookNote(title, meta) {
  return [
    `# ${title}`, "", "#books", "",
    `**Author:** ${pick(["Donella Meadows", "Don Norman", "James C. Scott"])}`,
    `**Completed:** ${pick(["Feb 2026", "Apr 2026", "May 2026"])}`,
    `**Rating:** ${pick(["8/10", "9/10", "7/10"])}`, "",
    "## The Big Idea", nextOpener(), "",
    "## Core Learnings",
    "1. " + pick(MIDDLES),
    "2. " + pick(WHY),
    "3. " + nextOpener(), "",
    "## Personal Takeaways", pick(WHY), "",
    "## Connections",
    `- Related: [[${pick(allTitles.filter((t) => !SUBJECTS.Books.notes.includes(t)))}]]`,
    "- See: [[Books MOC]]", "",
  ].join("\n")
}

function mocNote(subject, meta, notes) {
  const mocTitle = subject === "Computer Science" ? "CS MOC" : `${subject} MOC`
  const core = notes.slice(0, Math.ceil(notes.length / 2))
  const rest = notes.slice(core.length)
  const todos = sample([...UNRESOLVED, "Cache Invalidation", "Property Testing", "Amortized Analysis"], 3)
  return [
    `# ${mocTitle}`, "", `#moc #${meta.tag}`, "",
    "*Entry point for everything in this subject. Navigate from here.*", "",
    "## Core Concepts",
    ...core.map((n) => `- [[${n}]]`), "",
    "## Intermediate Concepts",
    ...rest.map((n) => `- [[${n}]]`), "",
    "## Topics To Explore",
    "*Unwritten notes — placeholders and future captures.*",
    ...todos.map((t) => `- [ ] ${t}`), "",
    "## Key Questions This Subject Answers",
    `- ${pick(WHY)}`, "",
  ].join("\n")
}

// ---- write ----
fs.rmSync(path.join(ROOT, ".."), { recursive: true, force: true })
fs.mkdirSync(ROOT, { recursive: true })

let count = 0
for (const [subject, meta] of Object.entries(SUBJECTS)) {
  fs.mkdirSync(path.join(ROOT, subject), { recursive: true })
  for (const title of meta.notes) {
    const others = allTitles.filter((t) => t !== title)
    const targets = sample(others, 2 + Math.floor(rand() * 2))
    const links = targets.map((t) => ({ relation: pick(RELATIONS), target: t }))
    // Every subject seeds at least one deliberate unresolved link.
    if (rand() > 0.75) links.push({ relation: "Related", target: pick(UNRESOLVED) })
    const body = subject === "Books" ? bookNote(title, meta) : conceptNote(title, subject, meta, links)
    fs.writeFileSync(path.join(ROOT, subject, `${title}.md`), body)
    count++
  }
}

fs.mkdirSync(path.join(ROOT, "Homebase"), { recursive: true })
for (const [subject, meta] of Object.entries(SUBJECTS)) {
  const mocTitle = subject === "Computer Science" ? "CS MOC" : `${subject} MOC`
  fs.writeFileSync(path.join(ROOT, "Homebase", `${mocTitle}.md`), mocNote(subject, meta, meta.notes))
}
fs.writeFileSync(
  path.join(ROOT, "Homebase", "Learn List.md"),
  ["# Learn List", "", "#moc", "", "*What I want to learn next, loosely ordered.*", "",
   "## Active", "- [ ] Distributed systems failure modes", "- [ ] Bayesian statistics", "",
   "## Up Next", "- [ ] Machine learning fundamentals", "- [ ] Architecture and urban form", "",
   "## Eventually", "- [ ] Wine", "- [ ] Cheese", ""].join("\n"),
)

// index.md — the subject grid, matching the real vault's hand-written HTML.
const cards = Object.entries(SUBJECTS)
  .map(([subject, meta]) => {
    const slug = (subject === "Computer Science" ? "CS MOC" : `${subject} MOC`).replace(/\s/g, "-")
    const cls = subject.toLowerCase().replace(/\s+/g, "-")
    return `  <a href="/Homebase/${slug}" class="subject-card ${cls}">\n    <div class="card-body">\n      <div class="card-title">${subject}</div>\n      <div class="card-desc">${meta.desc}</div>\n    </div>\n  </a>`
  })
  .join("\n")

const recent = sample(allTitles, 6).map((t) => `- [[${t}]] — Aug 20, 2026`).join("\n")
fs.writeFileSync(
  path.join(ROOT, "index.md"),
  `---\ntitle: Demo Brain\n---\n\n<p class="brain-tagline">The mind is for having ideas, not holding them.</p>\n\n## Subjects\n\n<div class="subject-grid">\n${cards}\n</div>\n\n## Recently Added\n\n${recent}\n`,
)

// Templates and Inbox, so the shapes the app reads and writes both exist.
fs.mkdirSync(path.join(ROOT, "Templates"), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, "Templates", "Concept.md"),
  ["# {{Title}}", "", "#tag", "", "## What It Is",
   "*One or two sentences. Define the concept clearly in your own words.*", "",
   "## How It Works", "*The mechanism, logic, or structure. Use examples.*", "",
   "## Why It Matters", "*What does knowing this enable? What problems does it solve?*", "",
   "## Key Properties / Characteristics", "-", "-", "",
   "## Connections", "- Related: [[]]", "- Builds on: [[]]", "- Enables: [[]]",
   "- Contrasts with: [[]]", "", "## Source",
   "*Where did you learn this? Book, course, article, video.*", ""].join("\n"),
)
fs.writeFileSync(
  path.join(ROOT, "Templates", "MOC.md"),
  ["# {{Subject}} MOC", "", "#moc #tag", "",
   "*Entry point for everything in this subject. Navigate from here.*", "",
   "## Core Concepts", "- [[]]", "", "## Intermediate Concepts", "- [[]]", "",
   "## Topics To Explore", "*Unwritten notes — placeholders and future captures.*",
   "- [ ]", "", "## Key Questions This Subject Answers", "-", ""].join("\n"),
)
fs.mkdirSync(path.join(ROOT, "Inbox"), { recursive: true })

fs.writeFileSync(
  path.join(ROOT, "CLAUDE.md"),
  ["# Demo vault processing rules", "",
   "Stand-in for the real `brain/CLAUDE.md`, which the app reads from disk at",
   "request time rather than copying (PRD §7). The real file is ~22 KB.", "",
   "## Core principle",
   "Value comes from connections, not from storage. A note that links to five",
   "other notes is worth far more than five isolated notes.", "",
   "## Rules",
   "- One concept, one note.",
   "- Own words only. Nothing is pasted; everything is rewritten as if explaining to someone else.",
   "- Preserve the author's original phrasing as the base. Enrichment is additive.",
   "- You are a tutor reviewing your student's notes, not a textbook author.",
   "- Link liberally, including to notes that do not exist yet.",
   "- The inbox is processed, not accumulated.", ""].join("\n"),
)

console.log(`demo vault: ${count} concept/book notes + ${Object.keys(SUBJECTS).length} MOCs at ${ROOT}`)
