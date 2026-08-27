import { getConfig } from "@/lib/config"

/**
 * States plainly, on the screen, which parts of the app are live and which are
 * not. A demo deployment must never look like it is serving real data or
 * writing to a real vault.
 */
export function CapabilityNotice() {
  const cfg = getConfig()
  if (cfg.hasVault && cfg.hasDatabase && cfg.hasAnthropic) return null

  const missing: string[] = []
  if (!cfg.hasVault) missing.push("BRAIN_PATH")
  if (!cfg.hasDatabase) missing.push("DATABASE_URL")
  if (!cfg.hasAnthropic) missing.push("ANTHROPIC_API_KEY")

  return (
    <div className="notice warn" style={{ marginBottom: 18 }}>
      <b>{cfg.hasVault ? "Partly configured." : "Demo mode."}</b>{" "}
      {!cfg.hasVault && (
        <>
          No <code>BRAIN_PATH</code> is set, so this instance is reading a bundled synthetic vault,
          not a real one. Nothing here can be written to disk or committed.{" "}
        </>
      )}
      {cfg.hasVault && !cfg.hasDatabase && (
        <>
          The vault is live, but there is no <code>DATABASE_URL</code>, so sources and highlights
          shown are demo rows and cannot be saved.{" "}
        </>
      )}
      {!cfg.hasAnthropic && (
        <>
          No <code>ANTHROPIC_API_KEY</code>, so extraction returns a pre-written proposal set rather
          than calling a model — enough to drive the review gate, but it is canned.{" "}
        </>
      )}
      <span className="meta">Unset: {missing.join(", ")}</span>
    </div>
  )
}
