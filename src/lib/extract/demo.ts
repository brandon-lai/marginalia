import type { Extractor, CaptureContext, VaultContext } from "./types"
import type { ProposalSet } from "../types"
import { DEMO_PROPOSALS, DEMO_UNUSED } from "../db/demo-data"

/**
 * Returns a fixed, pre-written proposal set. Used only when no ANTHROPIC_API_KEY
 * is configured, so the review gate — the screen the PRD calls the product — can
 * be seen and driven on a deployment with no credentials.
 *
 * It is labelled as canned in the UI. It never calls a model and never pretends
 * to have.
 */
export class DemoExtractor implements Extractor {
  readonly name = "demo"

  async propose(capture: CaptureContext, _ctx: VaultContext): Promise<ProposalSet> {
    const forSource = DEMO_PROPOSALS.filter((p) => p.sourceId === capture.source.id)
    if (forSource.length) {
      return { notes: forSource.map((p) => p.payload), unused: DEMO_UNUSED }
    }
    return {
      notes: [],
      unused: capture.highlights.map((h) => ({
        highlight: h.id,
        reason: "No canned proposal exists for this source. Configure ANTHROPIC_API_KEY to run real extraction.",
      })),
    }
  }
}
