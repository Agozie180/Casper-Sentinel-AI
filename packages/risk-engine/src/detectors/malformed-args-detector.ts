import { RiskSignalImpact } from "@casper-sentinel/domain";
import type { Detector } from "../types.js";
import { createSignal, isBlank, parseMotes } from "../utils.js";

export const malformedArgsDetector: Detector = {
  id: "malformed-args",
  analyze(intent) {
    const signals = [];

    if (isBlank(intent.walletAddress)) {
      signals.push(
        createSignal({
          id: "input.wallet.missing",
          detectorId: this.id,
          category: "input",
          severity: 1,
          confidence: 1,
          weight: 1.2,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The transaction intent is missing a wallet address."],
          inferred: ["Sentinel cannot attribute the transaction to a signer safely."],
        }),
      );
    }

    if (isBlank(intent.target)) {
      signals.push(
        createSignal({
          id: "input.target.missing",
          detectorId: this.id,
          category: "input",
          severity: 1,
          confidence: 1,
          weight: 1.2,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The transaction intent is missing a target address or contract hash."],
          inferred: ["Sentinel cannot inspect a transaction with an unknown destination."],
        }),
      );
    }

    if (intent.amountMotes !== undefined && parseMotes(intent.amountMotes) === undefined) {
      signals.push(
        createSignal({
          id: "input.amount.invalid",
          detectorId: this.id,
          category: "input",
          severity: 0.85,
          confidence: 1,
          weight: 1.1,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The transfer amount is not a valid unsigned integer mote value."],
          inferred: ["Malformed value fields can hide transaction intent or break simulation."],
          evidence: [{ label: "amountMotes", value: intent.amountMotes, source: "intent" }],
        }),
      );
    }

    if (intent.approvalScope?.allowanceMotes !== undefined && parseMotes(intent.approvalScope.allowanceMotes) === undefined) {
      signals.push(
        createSignal({
          id: "input.approval.invalid-allowance",
          detectorId: this.id,
          category: "input",
          severity: 0.85,
          confidence: 1,
          weight: 1.1,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The approval allowance is not a valid unsigned integer mote value."],
          inferred: ["Sentinel cannot safely evaluate malformed approval scope."],
          evidence: [{ label: "allowanceMotes", value: intent.approvalScope.allowanceMotes, source: "intent" }],
        }),
      );
    }

    return Promise.resolve(signals);
  },
};
