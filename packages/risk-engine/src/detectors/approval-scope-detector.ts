import { RiskSignalImpact, TransactionKind } from "@casper-sentinel/domain";
import type { Detector } from "../types.js";
import { createSignal, parseMotes } from "../utils.js";

export const approvalScopeDetector: Detector = {
  id: "approval-scope",
  analyze(intent, context) {
    if (intent.transactionKind !== TransactionKind.Approval) {
      return Promise.resolve([]);
    }

    const scope = intent.approvalScope;
    if (scope === undefined) {
      return Promise.resolve([
        createSignal({
          id: "approval.scope.missing",
          detectorId: this.id,
          category: "approval",
          severity: 0.8,
          confidence: 0.9,
          weight: 1.05,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The transaction is an approval but no approval scope was provided."],
          inferred: ["Sentinel cannot safely bound approval risk without spender and allowance data."],
        }),
      ]);
    }

    if (scope.unlimited === true) {
      return Promise.resolve([
        createSignal({
          id: "approval.scope.unlimited",
          detectorId: this.id,
          category: "approval",
          severity: 0.92,
          confidence: 0.95,
          weight: 1.2,
          impact: RiskSignalImpact.HardBlock,
          observed: ["The approval grants unlimited spending authority."],
          inferred: ["Unlimited approvals can let a compromised spender drain funds later."],
          evidence: [{ label: "spender", value: scope.spender, source: "intent" }],
        }),
      ]);
    }

    const allowance = parseMotes(scope.allowanceMotes);
    const maxApproval = parseMotes(context.policy.maxApprovalMotes) ?? 0n;
    if (allowance !== undefined && allowance > maxApproval) {
      return Promise.resolve([
        createSignal({
          id: "approval.scope.excessive",
          detectorId: this.id,
          category: "approval",
          severity: 0.68,
          confidence: 0.9,
          weight: 1.05,
          impact: RiskSignalImpact.Warn,
          observed: ["The approval allowance exceeds the configured maximum approval threshold."],
          inferred: ["Large approvals increase future loss if the spender is compromised."],
          evidence: [
            { label: "allowanceMotes", value: scope.allowanceMotes ?? "", source: "intent" },
            { label: "maxApprovalMotes", value: context.policy.maxApprovalMotes, source: "policy" },
          ],
        }),
      ]);
    }

    return Promise.resolve([]);
  },
};
