import { execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)

/**
 * Dates come from git, never fs.stat — Google Drive rewrites mtimes on sync
 * (system guide §1.3, invariant 5). One batched `git log` pass covers the whole
 * vault; at 237 files this is a few hundred milliseconds.
 */

export interface GitDates {
  createdAt?: string
  updatedAt?: string
}

async function git(repo: string, args: string[], timeoutMs = 30_000): Promise<string> {
  const { stdout } = await exec("git", ["-C", repo, ...args], {
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  })
  return stdout
}

export async function isGitRepo(repo: string): Promise<boolean> {
  try {
    await git(repo, ["rev-parse", "--git-dir"], 5_000)
    return true
  } catch {
    return false
  }
}

/**
 * Map of vault-relative path -> {createdAt, updatedAt}.
 * `--diff-filter=A` gives the add commit (created); the newest commit touching
 * a path gives updated. Both come from one traversal each.
 */
export async function batchGitDates(repo: string, vaultPrefix: string): Promise<Map<string, GitDates>> {
  const out = new Map<string, GitDates>()
  if (!(await isGitRepo(repo))) return out

  const prefix = vaultPrefix.replace(/\/$/, "")

  // Created: earliest add. Walk newest-first and let earlier commits overwrite,
  // so the final value is the oldest add for each path.
  for (const [filter, key] of [
    ["--diff-filter=A", "createdAt"],
    [null, "updatedAt"],
  ] as const) {
    const args = ["log", "--pretty=format:%x00%aI", "--name-only"]
    if (filter) args.push(filter)
    args.push("--", `${prefix}/**/*.md`, `${prefix}/*.md`)

    let stdout: string
    try {
      stdout = await git(repo, args)
    } catch {
      continue
    }

    let date: string | undefined
    for (const line of stdout.split("\n")) {
      if (line.startsWith("\0")) {
        date = line.slice(1).trim()
        continue
      }
      const p = line.trim()
      if (!p || !date) continue
      if (!p.startsWith(prefix + "/")) continue
      const rel = p.slice(prefix.length + 1)
      const entry = out.get(rel) ?? {}
      // created: keep overwriting so the oldest (last seen) wins
      // updated: keep the first seen (newest) only
      if (key === "createdAt") entry.createdAt = date
      else if (!entry.updatedAt) entry.updatedAt = date
      out.set(rel, entry)
    }
  }

  return out
}

/**
 * The "Recently Added" one-liner from system guide §4.4, reimplemented so the
 * app produces the same six notes the protocol's shell pipeline would.
 */
export async function recentlyAdded(
  repo: string,
  vaultPrefix: string,
  limit = 6,
): Promise<{ path: string; title: string; date: string }[]> {
  const dates = await batchGitDates(repo, vaultPrefix)
  const skip = /(^|\/)(\.claude|Homebase|Templates|Inbox|index\.md|CLAUDE\.md)/
  const rows = [...dates.entries()]
    .filter(([p, d]) => d.createdAt && !skip.test(p))
    .sort((a, b) => (a[1].createdAt! < b[1].createdAt! ? 1 : -1))
    .slice(0, limit)
  return rows.map(([p, d]) => ({
    path: p,
    title: p.split("/").pop()!.replace(/\.md$/, ""),
    date: formatDate(d.createdAt!),
  }))
}

/** "Jun 04, 2026" — the format index.md's Recently Added block uses. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${month} ${day}, ${d.getUTCFullYear()}`
}

export async function commitAll(
  repo: string,
  message: string,
  push: boolean,
): Promise<{ sha: string; pushed: boolean }> {
  await git(repo, ["add", "-A"])
  try {
    await git(repo, ["commit", "-m", message])
  } catch (e: unknown) {
    const msg = String((e as { stdout?: string })?.stdout ?? e)
    if (!/nothing to commit/i.test(msg)) throw e
  }
  const sha = (await git(repo, ["rev-parse", "HEAD"])).trim()

  let pushed = false
  if (push) {
    // Plain push, never `npx quartz sync` — sync pulls Quartz's upstream v4
    // branch into main and drags in unrelated generator changes (guide §4.3).
    const branch = (await git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])).trim()
    await git(repo, ["push", "origin", branch], 120_000)
    pushed = true
  }
  return { sha, pushed }
}
