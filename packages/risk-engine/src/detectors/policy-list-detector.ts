import { RiskSignalImpact } from "@casper-sentinel/domain";
import type { Detector } from "../types.js";
import { createSignal } from "../utils.js";

export const policyListDetector: Detector = {
  id: "policy-list",
  analyze(intent, context) {
    const signals = [];

    if (context.policy.denylistedWallets.includes(intent.walletAddress)) {
      signals.push(
        createSignal({
          id: "policy.wallet.denylisted",
          detectorId: this.id,
          category: "policy",
          severity: 1,
          confidence: 1,
          weight: 1.3,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The signing wallet appears on the configured denylist."],
          inferred: ["Transactions from denylisted wallets violate local security policy."],
          evidence: [{ label: "walletAddress", value: intent.walletAddress, source: "policy" }],
        }),
      );
    }

    if (context.policy.denylistedTargets.includes(intent.target)) {
      signals.push(
        createSignal({
          id: "policy.target.denylisted",
          detectorId: this.id,
          category: "policy",
          severity: 1,
          confidence: 1,
          weight: 1.3,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The transaction target appears on the configured denylist."],
          inferred: ["The transaction violates an explicit block rule."],
          evidence: [{ label: "target", value: intent.target, source: "policy" }],
        }),
      );
    }

    return Promise.resolve(signals);
  },
};
