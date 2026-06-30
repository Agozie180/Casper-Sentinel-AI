import { RiskSignalImpact } from "@casper-sentinel/domain";
import type { Detector } from "../types.js";
import { createSignal } from "../utils.js";

export const targetDetector: Detector = {
  id: "target",
  analyze(intent, context) {
    if (context.policy.allowlistedTargets.includes(intent.target)) {
      return Promise.resolve([]);
    }

    if (context.policy.knownContracts[intent.target] === undefined) {
      return Promise.resolve([
        createSignal({
          id: "target.unknown",
          detectorId: this.id,
          category: "contract",
          severity: 0.35,
          confidence: 0.8,
          weight: 0.85,
          impact: RiskSignalImpact.Warn,
          observed: ["The target is not present in the configured trusted contract registry."],
          inferred: ["Unknown targets may still be safe, but they require extra review."],
          evidence: [{ label: "target", value: intent.target, source: "intent" }],
        }),
      ]);
    }

    return Promise.resolve([]);
  },
};
