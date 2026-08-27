import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { htmlToText, countWords } from "./_load.mjs"

test("block elements become newlines so paragraphs survive", () => {
  const t = htmlToText("<p>One.</p><p>Two.</p><h2>Head</h2><ul><li>a</li><li>b</li></ul>")
  assert.deepEqual(t.split("\n").filter(Boolean), ["One.", "Two.", "Head", "a", "b"])
})

test("script and style bodies are dropped, not flattened into the text", () => {
  const t = htmlToText('<p>Real.</p><script>var x = "not real";</script><style>p{color:red}</style>')
  assert.equal(t, "Real.")
})

test("entities decode, and &amp; is decoded last", () => {
  assert.equal(htmlToText("<p>a &amp; b</p>"), "a & b")
  assert.equal(htmlToText("<p>&lt;tag&gt;</p>"), "<tag>")
  assert.equal(htmlToText("<p>&#39;quoted&#39;</p>"), "'quoted'")
  assert.equal(htmlToText("<p>&#x2014;</p>"), "—")
  // "&amp;lt;" is a literal "&lt;", not a "<"
  assert.equal(htmlToText("<p>&amp;lt;</p>"), "&lt;")
})

test("an out-of-range numeric entity does not throw", () => {
  assert.doesNotThrow(() => htmlToText("<p>&#1114112;</p>"))
  assert.doesNotThrow(() => htmlToText("<p>&#999999999999;</p>"))
})

// The reason this module exists: importing it must not pull in jsdom, which
// cannot be loaded at all in some serverless runtimes and previously took the
// whole /source/[id] page module down with it.
test("html-text.ts has no imports at all", () => {
  const src = readFileSync(new URL("../src/lib/reader/html-text.ts", import.meta.url), "utf8")
  assert.equal(
    /^\s*import\s/m.test(src),
    false,
    "html-text.ts must stay dependency-free — it is the module that runs where jsdom cannot",
  )
})

test("countWords counts words, not tags", () => {
  assert.equal(countWords(htmlToText("<p>one two three</p>")), 3)
})
