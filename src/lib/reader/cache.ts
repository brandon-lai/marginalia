import "server-only"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { getConfig } from "../config"

/**
 * Reader HTML cache. The PRD specifies Supabase Storage so a deployed instance
 * can serve it too; that is an object store keyed by source id, and this is the
 * same contract over the local filesystem. Swapping in the Supabase Storage
 * client means replacing these two functions and nothing above them.
 *
 * Cached articles are the app's own data, not vault knowledge, so they live
 * outside brain/ — nothing here is ever committed to the vault repo.
 */

export interface CachedArticle {
  ok: true
  title: string
  byline: string | null
  siteName: string | null
  html: string
  text?: string
  wordCount: number
}

function cacheDir(): string {
  return process.env.READER_CACHE_DIR ?? path.join(process.cwd(), ".cache", "reader")
}

function fileFor(key: string): string {
  const safe = createHash("sha256").update(key).digest("hex").slice(0, 32)
  return path.join(cacheDir(), `${safe}.json`)
}

export async function readCache(key: string): Promise<CachedArticle | null> {
  try {
    const raw = await fs.readFile(fileFor(key), "utf8")
    return JSON.parse(raw) as CachedArticle
  } catch {
    return null
  }
}

export async function writeCache(key: string, article: CachedArticle): Promise<void> {
  // A read-only filesystem (a serverless deployment) is not an error — the
  // article is still served, it just is not cached.
  try {
    await fs.mkdir(cacheDir(), { recursive: true })
    await fs.writeFile(fileFor(key), JSON.stringify(article), "utf8")
  } catch {
    void getConfig()
  }
}
