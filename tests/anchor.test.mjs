import { test } from "node:test"
import assert from "node:assert/strict"
import { anchor, anchorAll } from "./_load.mjs"

const TEXT = [
  "The uncomfortable part is that sampling decisions made at the edge cannot be",
  "revisited once the trace has been discarded. Tail-based sampling moves the",
  "decision to the collector. Later on we repeat: sampling decisions made at the",
  "edge cannot be revisited once the trace has been discarded, again.",
].join("\n")

test("prefix + text + suffix disambiguates a repeated quote", () => {
  const r = anchor(TEXT, {
    text: "sampling decisions made at the edge cannot be revisited once the trace has been discarded",
    prefix: "The uncomfortable part is that",
    suffix: ". Tail-based sampling",
  })
  assert.ok(r)
  assert.equal(r.strategy, "exact")
  assert.equal(TEXT.slice(r.start, r.end).replace(/\s+/g, " "),
    "sampling decisions made at the edge cannot be revisited once the trace has been discarded")
  assert.ok(r.start < 100, "should match the first occurrence, not the later repeat")
})

test("position_hint picks the nearer occurrence when there is no prefix", () => {
  const late = anchor(TEXT, { text: "sampling decisions made at the edge", positionHint: 200 })
  const early = anchor(TEXT, { text: "sampling decisions made at the edge", positionHint: 0 })
  assert.ok(late.start > early.start)
})

test("anchoring survives re-flowed whitespace", () => {
  const reflowed = TEXT.replace(/\n/g, "   ")
  const r = anchor(reflowed, {
    text: "sampling decisions made at the edge cannot be\nrevisited",
    prefix: "The uncomfortable part is that",
  })
  assert.ok(r, "should still anchor when the source line wrapping changed")
})

test("a quote whose tail was edited still anchors fuzzily", () => {
  const r = anchor(TEXT, {
    text: "Tail-based sampling moves the decision to the collector and buffers everything first",
  })
  assert.ok(r)
  assert.equal(r.strategy, "fuzzy")
})

test("a quote that is really gone returns null rather than throwing", () => {
  assert.equal(anchor(TEXT, { text: "this sentence does not appear anywhere at all in the text" }), null)
})

test("overlapping highlights: the loser is reported unanchored, never dropped", () => {
  const out = anchorAll(TEXT, [
    { id: "a", text: "sampling decisions made at the edge", prefix: "The uncomfortable part is that" },
    { id: "b", text: "decisions made at the edge cannot be revisited", prefix: "The uncomfortable part is that sampling" },
  ])
  assert.equal(out.length, 2, "no highlight is ever discarded")
  assert.ok(out[0].range)
  assert.equal(out[1].range, null)
})
