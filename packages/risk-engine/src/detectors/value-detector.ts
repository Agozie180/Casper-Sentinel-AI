import { RiskSignalImpact } from "@casper-sentinel/domain";
import type { Detector } from "../types.js";
import { createSignal, parseMotes } from "../utils.js";

export const valueDetector: Detector = {
  id: "value",
  analyze(intent, context) {
    const amount = parseMotes(intent.amountMotes);
    if (amount === undefined) return Promise.resolve([]);

    const highValue = parseMotes(context.policy.highValueMotes) ?? 0n;
    const blockValue = parseMotes(context.policy.blockValueMotes) ?? highValue;

    if (amount >= blockValue) {
      return Promise.resolve([
        createSignal({
          id: "value.block-threshold",
          detectorId: this.id,
          category: "wallet",
          severity: 0.9,
          confidence: 0.95,
          weight: 1.15,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The transfer amount meets or exceeds the configured block threshold."],
          inferred: ["High-value movement should not proceed without stronger verification."],
          evidence: [
            { label: "amountMotes", value: intent.amountMotes ?? "", source: "intent" },
            { label: "blockValueMotes", value: context.policy.blockValueMotes, source: "policy" },
          ],
        }),
      ]);
    }

    if (amount >= highValue) {
      return Promise.resolve([
        createSignal({
          id: "value.warning-threshold",
          detectorId: this.id,
          category: "wallet",
          severity: 0.45,
          confidence: 0.9,
          weight: 0.9,
          impact: RiskSignalImpact.Warn,
          observed: ["The transfer amount exceeds the configured high-value warning threshold."],
          inferred: ["Large transfers deserve user review before signing."],
          evidence: [
            { label: "amountMotes", value: intent.amountMotes ?? "", source: "intent" },
            { label: "highValueMotes", value: context.policy.highValueMotes, source: "policy" },
          ],
        }),
      ]);
    }

    return Promise.resolve([]);
  },
};
