import { RiskSignalImpact, TransactionKind } from "@casper-sentinel/domain";
import type { Detector } from "../types.js";
import { createSignal } from "../utils.js";

export const metadataDetector: Detector = {
  id: "contract-metadata",
  analyze(intent, context) {
    if (intent.transactionKind !== TransactionKind.ContractCall && intent.transactionKind !== TransactionKind.Approval) {
      return Promise.resolve([]);
    }

    const metadata = context.policy.knownContracts[intent.target];
    if (metadata === undefined) {
      return Promise.resolve([
        createSignal({
          id: "metadata.missing",
          detectorId: this.id,
          category: "contract",
          severity: 0.4,
          confidence: 0.8,
          weight: 0.9,
          impact: RiskSignalImpact.Warn,
          observed: ["No contract metadata is available for the transaction target."],
          inferred: ["Missing metadata limits Sentinel's ability to explain contract behavior."],
          evidence: [{ label: "target", value: intent.target, source: "contract-context" }],
        }),
      ]);
    }

    const signals = [];
    if (!metadata.verified) {
      signals.push(
        createSignal({
          id: "metadata.unverified",
          detectorId: this.id,
          category: "contract",
          severity: 0.55,
          confidence: 0.85,
          weight: 1,
          impact: RiskSignalImpact.Warn,
          observed: ["The target contract metadata is present but not marked verified."],
          inferred: ["Unverified contracts require manual review before signing."],
          evidence: [{ label: "target", value: intent.target, source: "contract-context" }],
        }),
      );
    }

    if (
      intent.entryPoint !== undefined &&
      metadata.allowedEntryPoints !== undefined &&
      !metadata.allowedEntryPoints.includes(intent.entryPoint)
    ) {
      signals.push(
        createSignal({
          id: "metadata.entry-point.unexpected",
          detectorId: this.id,
          category: "contract",
          severity: 0.65,
          confidence: 0.9,
          weight: 1.05,
          impact: RiskSignalImpact.Warn,
          observed: ["The requested entry point is not in the contract's allowed entry-point list."],
          inferred: ["Unexpected entry points may indicate a mismatched or risky contract call."],
          evidence: [
            { label: "entryPoint", value: intent.entryPoint, source: "intent" },
            { label: "target", value: intent.target, source: "contract-context" },
          ],
        }),
      );
    }

    return Promise.resolve(signals);
  },
};
