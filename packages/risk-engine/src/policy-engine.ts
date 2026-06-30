import {
  DecisionAction,
  RiskSignalImpact,
  assertRiskScoreValue,
  type Decision,
  type RiskScore,
  type SecurityPolicy,
} from "@casper-sentinel/domain";

/** Converts a risk score and policy into the autonomous approve, warn, or block decision. */
export function decide(score: RiskScore, policy: SecurityPolicy): Decision {
  assertRiskScoreValue(score.value);
  assertRiskScoreValue(policy.warnScore);
  assertRiskScoreValue(policy.blockScore);

  const hardBlockSignals = score.signals.filter((signal) => signal.impact === RiskSignalImpact.HardBlock);
  if (hardBlockSignals.length > 0) {
    return {
      action: DecisionAction.Block,
      score,
      reasons: hardBlockSignals.flatMap((signal) => signal.observed),
      policyVersion: policy.version,
      requiredUserMessage:
        "Blocked because one or more configured security rules produced a hard-block signal.",
    };
  }

  if (score.value >= policy.blockScore) {
    return {
      action: DecisionAction.Block,
      score,
      reasons: ["The aggregated risk score meets or exceeds the block threshold."],
      policyVersion: policy.version,
      requiredUserMessage:
        "Blocked because the transaction risk score exceeds the configured policy threshold.",
    };
  }

  if (score.value >= policy.warnScore || score.signals.some((signal) => signal.impact === RiskSignalImpact.Warn)) {
    return {
      action: DecisionAction.Warn,
      score,
      reasons: score.signals.flatMap((signal) => signal.observed),
      policyVersion: policy.version,
      requiredUserMessage:
        "Review this transaction carefully before signing. Sentinel found risk signals that deserve attention.",
    };
  }

  return {
    action: DecisionAction.Approve,
    score,
    reasons: ["No configured detector emitted a warning or blocking signal."],
    policyVersion: policy.version,
    requiredUserMessage: "Approved. Sentinel did not find material risk in the provided transaction intent.",
  };
}
