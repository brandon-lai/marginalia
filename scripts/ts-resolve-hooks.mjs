import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") || specifier.startsWith("@/")) {
    const base = specifier.startsWith("@/")
      ? new URL("../src/" + specifier.slice(2), import.meta.url)
      : new URL(specifier, context.parentURL)
    for (const cand of [base.href, base.href + ".ts", base.href + ".tsx", base.href + "/index.ts"]) {
      try {
        if (existsSync(fileURLToPath(cand))) return next(cand, context)
      } catch {
        /* not a file url */
      }
    }
  }
  return next(specifier, context)
}
