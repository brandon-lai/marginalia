import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { splitSections, joinSections, applyMocUpdate, openTodos } from "./_load.mjs"

const VAULT = process.env.BRAIN_PATH ?? path.join(process.cwd(), "demo-vault", "brain")

function mocFiles() {
  const dir = path.join(VAULT, "Homebase")
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f))
}

test("splitSections round-trips every MOC byte for byte", () => {
  const files = mocFiles()
  assert.ok(files.length > 0, "no MOCs found to test against")
  for (const f of files) {
    const raw = fs.readFileSync(f, "utf8")
    assert.equal(joinSections(splitSections(raw)), raw, `round-trip changed ${path.basename(f)}`)
  }
})

// PRD §11: "A MOC edit leaves every untouched section byte-identical."
test("a MOC edit leaves every untouched section byte-identical", () => {
  const files = mocFiles()
  for (const f of files) {
    const raw = fs.readFileSync(f, "utf8")
    const before = splitSections(raw)
    const target = before.find((s) => s.heading === "Core Concepts") ?? before.find((s) => s.heading)
    if (!target) continue

    const { content } = applyMocUpdate(raw, {
      section: target.heading,
      addLink: "[[A Brand New Note]] — inserted by the test",
    })
    const after = splitSections(content)

    for (const sec of before) {
      if (sec.heading === target.heading) continue
      const match = after.find((s) => s.heading === sec.heading)
      assert.ok(match, `section ${sec.heading} vanished from ${path.basename(f)}`)
      assert.equal(
        match.lines.join("\n"),
        sec.lines.join("\n"),
        `section "${sec.heading}" of ${path.basename(f)} was modified but should not have been`,
      )
    }
  }
})

test("the todo is removed, not left as a checked box", () => {
  const src = [
    "# System Design MOC", "", "#moc #system-design", "",
    "## Core Concepts", "- [[Cache]]", "",
    "## Topics To Explore", "*Unwritten notes.*",
    "- [ ] Distributed Tracing", "- [ ] Service Discovery", "",
    "## Key Questions", "- Why does this matter?", "",
  ].join("\n")

  const { content, diff } = applyMocUpdate(src, {
    section: "Core Concepts",
    addLink: "[[Distributed Tracing]] — spans, context propagation, sampling",
    removeTodo: "Distributed Tracing",
  })

  assert.match(content, /- \[\[Distributed Tracing\]\] — spans/)
  assert.doesNotMatch(content, /- \[ \] Distributed Tracing/)
  assert.doesNotMatch(content, /- \[x\] Distributed Tracing/i)
  assert.match(content, /- \[ \] Service Discovery/)
  assert.match(content, /## Key Questions\n- Why does this matter\?/)

  assert.ok(diff.some((d) => d.kind === "add" && d.text.includes("Distributed Tracing")))
  assert.ok(diff.some((d) => d.kind === "remove" && d.text.includes("[ ] Distributed Tracing")))
})

test("a todo written as a wikilink still matches", () => {
  const src = ["# X MOC", "", "## Core Concepts", "- [[A]]", "", "## Topics To Explore", "- [ ] [[Queue]]", ""].join("\n")
  const { content } = applyMocUpdate(src, { section: "Core Concepts", addLink: "[[Queue]] — FIFO", removeTodo: "Queue" })
  assert.doesNotMatch(content, /- \[ \] \[\[Queue\]\]/)
})

test("headings inside fenced code blocks are not treated as sections", () => {
  const src = ["# X MOC", "", "## Core Concepts", "- [[A]]", "", "```bash", "## not a heading", "```", "", "## Topics To Explore", "- [ ] B", ""].join("\n")
  const sections = splitSections(src)
  assert.deepEqual(sections.map((s) => s.heading), ["", "Core Concepts", "Topics To Explore"])
  assert.equal(joinSections(sections), src)
})

test("openTodos reports the section each item came from", () => {
  const src = ["# X MOC", "", "## Topics To Explore", "- [ ] Alpha", "- [x] Done", "", "## Other", "- [ ] Beta", ""].join("\n")
  assert.deepEqual(openTodos(src), [
    { text: "Alpha", section: "Topics To Explore" },
    { text: "Beta", section: "Other" },
  ])
})

// The review screen's whole premise is that the diff shown is the diff applied.
// A diff that proposes removing entries it merely failed to recompute is worse
// than no diff at all.
test("Recently Added never proposes dropping entries git could not recompute", async () => {
  const { existingRecentlyAdded, projectRecentlyAdded, updateRecentlyAdded } = await import("./_load.mjs")
  const indexMd = [
    "---", "title: Brandon's Brain", "---", "",
    "## Subjects", "", '<div class="subject-grid">', "</div>", "",
    "## Recently Added", "",
    "- [[Anamorphosis]] — Jun 04, 2026",
    "- [[Donor Portraits]] — Jun 04, 2026",
    "- [[Byzantine vs. Western Depictions of Christ]] — Jun 04, 2026",
    "",
  ].join("\n")

  const existing = existingRecentlyAdded(indexMd)
  assert.equal(existing.length, 3)
  assert.equal(existing[2].title, "Byzantine vs. Western Depictions of Christ")

  // git returns nothing (no history, shallow clone, demo vault)
  const projected = projectRecentlyAdded([], existing, { title: "Distributed Tracing", date: "Aug 27, 2026" })
  assert.equal(projected.length, 4)
  assert.equal(projected[0].title, "Distributed Tracing")

  const { diff, content } = updateRecentlyAdded(indexMd, projected)
  assert.equal(diff.filter((d) => d.kind === "remove").length, 0, "nothing should be removed")
  assert.equal(diff.filter((d) => d.kind === "add").length, 1)
  for (const e of existing) assert.match(content, new RegExp(`\\[\\[${e.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`))
})

test("the incoming note is never listed twice", async () => {
  const { projectRecentlyAdded } = await import("./_load.mjs")
  const out = projectRecentlyAdded(
    [{ title: "Cache", date: "Jun 01, 2026" }],
    [{ title: "Cache", date: "Jun 01, 2026" }, { title: "Big O", date: "May 30, 2026" }],
    { title: "Cache", date: "Aug 27, 2026" },
  )
  assert.deepEqual(out.map((x) => x.title), ["Cache", "Big O"])
  assert.equal(out[0].date, "Aug 27, 2026", "the incoming date wins")
})
