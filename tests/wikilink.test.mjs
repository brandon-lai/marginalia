import { test } from "node:test"
import assert from "node:assert/strict"
import { parseWikilinks, basenameOf, resolveTarget, parseTags, relationOf } from "./_load.mjs"

// PRD §5.2 / §11 — the test the PRD says to write first.
test("[[Byzantine vs. Western Depictions of Christ]] resolves, not truncated at the period", () => {
  const links = parseWikilinks("- Compare: [[Byzantine vs. Western Depictions of Christ]]")
  assert.equal(links.length, 1)
  assert.equal(links[0].target, "Byzantine vs. Western Depictions of Christ")
  assert.notEqual(links[0].target, "Byzantine vs")

  const byBasename = new Map([
    ["Byzantine vs. Western Depictions of Christ", "Art/Byzantine vs. Western Depictions of Christ.md"],
  ])
  assert.equal(
    resolveTarget(links[0].target, byBasename),
    "Art/Byzantine vs. Western Depictions of Christ.md",
  )
})

test("basenameOf strips folders and a real .md extension only", () => {
  assert.equal(basenameOf("Computer Science/Big O.md"), "Big O")
  assert.equal(basenameOf("Big O"), "Big O")
  assert.equal(basenameOf("Byzantine vs. Western Depictions of Christ"), "Byzantine vs. Western Depictions of Christ")
  assert.equal(basenameOf("Green's Theorem"), "Green's Theorem")
  assert.equal(basenameOf("Mandarin Vocabulary — Restaurants & Ordering"), "Mandarin Vocabulary — Restaurants & Ordering")
})

test("aliases, headings and embeds", () => {
  const l = parseWikilinks("[[Big O|complexity]] and [[Cache#Eviction]] and ![[Screenshot 2026-04-12 at 13.43.37.png]]")
  assert.equal(l[0].target, "Big O")
  assert.equal(l[0].alias, "complexity")
  assert.equal(l[1].target, "Cache")
  assert.equal(l[1].heading, "Eviction")
  assert.equal(l[2].isEmbed, true)
  assert.equal(l[2].target, "Screenshot 2026-04-12 at 13.43.37.png")
})

test("relation prefixes are parsed only inside ## Connections", () => {
  const md = [
    "## How It Works",
    "- Related: [[Not A Relation]]",
    "",
    "## Connections",
    "- Related: [[Array and List]], [[Hashmap and Dictionary]]",
    "- Builds on: [[Big O]]",
    "- Contrasts with: [[Queue]]",
    "- See: [[CS MOC]]",
  ].join("\n")
  const l = parseWikilinks(md)
  assert.equal(l.find((x) => x.target === "Not A Relation").relation, undefined)
  assert.equal(l.find((x) => x.target === "Array and List").relation, "Related")
  assert.equal(l.find((x) => x.target === "Hashmap and Dictionary").relation, "Related")
  assert.equal(l.find((x) => x.target === "Big O").relation, "Builds on")
  assert.equal(l.find((x) => x.target === "Queue").relation, "Contrasts with")
  assert.equal(l.find((x) => x.target === "CS MOC").relation, "See")
})

test("relationOf handles the template's missing space after the colon", () => {
  assert.equal(relationOf("- Contrasts with:[[W]]"), "Contrasts with")
})

test("tags come from the inline tag line, not headings or code fences", () => {
  const md = ["# Linked List", "", "#data-structures #cs", "", "## What It Is", "```css", "a { color: #hexcolor; }", "```"].join("\n")
  const tags = parseTags(md)
  assert.deepEqual(tags.sort(), ["cs", "data-structures"])
})
