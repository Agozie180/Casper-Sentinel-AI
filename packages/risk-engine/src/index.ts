import { riskBandForScore, type RiskScore, type RiskSignal, type TransactionIntent } from "@casper-sentinel/domain";
import { decide } from "./policy-engine.js";
import { createMvpDetectorRegistry } from "./registry.js";
import type { Detector, DetectorContext, DetectorRegistry } from "./types.js";

export type { Detector, DetectorContext, DetectorRegistry } from "./types.js";
export { decide } from "./policy-engine.js";
export { createDetectorRegistry, createMvpDetectorRegistry } from "./registry.js";
export { approvalScopeDetector } from "./detectors/approval-scope-detector.js";
export { malformedArgsDetector } from "./detectors/malformed-args-detector.js";
export { metadataDetector } from "./detectors/metadata-detector.js";
export { policyListDetector } from "./detectors/policy-list-detector.js";
export { targetDetector } from "./detectors/target-detector.js";
export { valueDetector } from "./detectors/value-detector.js";

export interface RiskEngine {
  analyze(intent: TransactionIntent, context: DetectorContext): Promise<RiskScore>;
}

/** Creates a deterministic risk engine from additive detectors. */
export function createRiskEngine(detectors: readonly Detector[] | DetectorRegistry): RiskEngine {
  const detectorList: readonly Detector[] = "detectors" in detectors ? detectors.detectors : detectors;
  return {
    async analyze(intent: TransactionIntent, context: DetectorContext): Promise<RiskScore> {
      const signalGroups = await Promise.all(
        detectorList.map((detector) => detector.analyze(intent, context)),
      );
      return aggregateSignals(signalGroups.flat());
    },
  };
}

/** Creates the default MVP engine with all deterministic detectors registered. */
export function createMvpRiskEngine(): RiskEngine {
  return createRiskEngine(createMvpDetectorRegistry());
}

/** Runs the MVP risk engine and converts the score into an autonomous decision. */
export async function analyzeAndDecide(intent: TransactionIntent, context: DetectorContext) {
  const score = await createMvpRiskEngine().analyze(intent, context);
  return decide(score, context.policy);
}

/** Aggregates detector signals into a bounded risk score while preserving evidence. */
export function aggregateSignals(signals: readonly RiskSignal[]): RiskScore {
  if (signals.length === 0) {
    return { value: 0, band: riskBandForScore(0), confidence: 1, signals };
  }

  const safeProbability = signals.reduce((remaining, signal) => {
    const normalizedSeverity = clamp01(signal.severity) * clamp01(signal.weight);
    return remaining * (1 - clamp01(normalizedSeverity));
  }, 1);
  const value = Math.round((1 - safeProbability) * 100);
  const confidence = roundToTwoDecimals(
    signals.reduce((total, signal) => total + clamp01(signal.confidence), 0) / signals.length,
  );

  return { value, band: riskBandForScore(value), confidence, signals };
}

/** Clamps detector-provided values into the normalized inclusive 0 to 1 interval. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Rounds a number to two decimal places for stable API responses and tests. */
export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

