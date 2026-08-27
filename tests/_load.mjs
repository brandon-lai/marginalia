// Node 22's built-in type stripping lets the tests import the real .ts sources
// directly, so there is no compiled copy that can drift from what ships.
export * from "../src/lib/vault/slug.ts"
export * from "../src/lib/vault/wikilink.ts"
export * from "../src/lib/vault/moc.ts"
export * from "../src/lib/vault/indexmd.ts"
export * from "../src/lib/vault/inbox.ts"
export * from "../src/lib/reader/anchor.ts"
export * from "../src/lib/vault/git.ts"
export * from "../src/lib/reader/html-text.ts"
