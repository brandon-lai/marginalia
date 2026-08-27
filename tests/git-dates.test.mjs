import { test } from "node:test"
import assert from "node:assert/strict"
import { formatDate } from "./_load.mjs"

// The vault's own history: "Quartz sync: Jun 4, 2026, 11:14 PM" at -04:00.
// index.md records those notes as "Jun 04, 2026". Formatting in UTC calls the
// same commit Jun 05 and rewrites the whole Recently Added block a day out.
test("dates are formatted in the commit's own timezone, not UTC", () => {
  assert.equal(formatDate("2026-06-04T23:14:00-04:00"), "Jun 04, 2026")
  assert.equal(formatDate("2026-06-04T23:14:00+00:00"), "Jun 04, 2026")
  assert.equal(formatDate("2026-01-01T00:30:00+09:00"), "Jan 01, 2026")
  assert.equal(formatDate("2026-03-28T18:51:04-04:00"), "Mar 28, 2026")
})

test("the day is zero-padded, matching index.md", () => {
  assert.equal(formatDate("2026-06-04T12:00:00-04:00"), "Jun 04, 2026")
  assert.match(formatDate("2026-06-14T12:00:00-04:00"), /^Jun 14, 2026$/)
})
