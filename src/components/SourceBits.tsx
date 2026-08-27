import type { Source } from "@/lib/types"

/**
 * Shared between the server-rendered source table and the client-side rail, so
 * these live outside the "use client" boundary — a server component cannot call
 * a function exported from a client module.
 */

export function StatusPill({ status }: { status: Source["status"] }) {
  const cls =
    status === "ready" || status === "processing" ? "ready"
    : status === "reading" ? "reading"
    : status === "processed" || status === "archived" ? "processed"
    : ""
  return <span className={`pill ${cls}`}>{status}</span>
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
