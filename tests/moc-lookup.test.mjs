import { test } from "node:test"
import assert from "node:assert/strict"
import { buildIndex, subjectFolders, mocFor } from "../src/lib/vault/index.ts"

// The naming convention is Homebase/<Subject> MOC.md, but the vault's largest
// subject is served by "CS MOC". Matching on the name alone reported
// "no MOC yet" for Computer Science on the vault browse screen.
test("every subject folder resolves to a MOC, including abbreviated ones", async () => {
  const index = await buildIndex()
  const subjects = subjectFolders(index)
  assert.ok(subjects.length > 0, "no subject folders found")

  const missing = subjects.filter((s) => !mocFor(index, s.folder)).map((s) => s.folder)
  assert.deepEqual(missing, [], `subjects with no MOC: ${missing.join(", ")}`)
})

test("Computer Science resolves to CS MOC by what the MOC links to", async () => {
  const index = await buildIndex()
  const cs = subjectFolders(index).find((s) => s.folder === "Computer Science")
  if (!cs) return // vault without that folder
  assert.equal(mocFor(index, "Computer Science")?.title, "CS MOC")
})
