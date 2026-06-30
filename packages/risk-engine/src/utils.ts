import { RiskSignalImpact, type RiskEvidence, type RiskSignal } from "@casper-sentinel/domain";

export interface SignalInput {
  readonly id: string;
  readonly detectorId: string;
  readonly category: RiskSignal["category"];
  readonly severity: number;
  readonly confidence?: number;
  readonly weight?: number;
  readonly impact?: RiskSignal["impact"];
  readonly observed: readonly string[];
  readonly inferred?: readonly string[];
  readonly evidence?: readonly RiskEvidence[];
}

/** Creates a normalized detector signal with conservative defaults. */
export function createSignal(input: SignalInput): RiskSignal {
  return {
    id: input.id,
    detectorId: input.detectorId,
    category: input.category,
    severity: input.severity,
    confidence: input.confidence ?? 0.8,
    weight: input.weight ?? 1,
    impact: input.impact ?? RiskSignalImpact.ScoreOnly,
    observed: input.observed,
    inferred: input.inferred ?? [],
    evidence: input.evidence ?? [],
  };
}

/** Parses a mote-denominated string into bigint without accepting floats or symbols. */
export function parseMotes(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  return BigInt(value);
}

/** Returns true when a text field is missing or only whitespace. */
export function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0;
}
