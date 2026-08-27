import { test } from "node:test"
import assert from "node:assert/strict"
import { slugifyFilePath, simplifySlug } from "./_load.mjs"

// PRD §11 — the four slugs named in the test checklist.
test("slug output matches Quartz for the checklist cases", () => {
  assert.equal(slugifyFilePath("Computer Science/Linked List.md"), "Computer-Science/Linked-List")
  assert.equal(slugifyFilePath("Homebase/CS MOC.md"), "Homebase/CS-MOC")
  assert.equal(
    slugifyFilePath("Languages/Mandarin Vocabulary — Restaurants & Ordering.md"),
    "Languages/Mandarin-Vocabulary-—-Restaurants--and--Ordering",
  )
  assert.equal(slugifyFilePath("index.md"), "index")
})

test("the & double hyphen is produced by ordering, not by accident", () => {
  // spaces become hyphens first, then & expands to -and-
  assert.equal(slugifyFilePath("A & B.md"), "A--and--B")
})

test("? and # are deleted, % expands", () => {
  assert.equal(slugifyFilePath("What Is This?.md"), "What-Is-This")
  assert.equal(slugifyFilePath("100% Rule.md"), "100-percent-Rule")
})

test("simplifySlug trims a trailing index so the homepage is /", () => {
  assert.equal(simplifySlug("index"), "/")
  assert.equal(simplifySlug("Homebase/CS-MOC"), "Homebase/CS-MOC")
})

test("_index is treated as index", () => {
  assert.equal(slugifyFilePath("Homebase/_index.md"), "Homebase/index")
})
