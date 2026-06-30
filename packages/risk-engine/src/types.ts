import type { RiskSignal, SecurityPolicy, TransactionIntent } from "@casper-sentinel/domain";

export interface DetectorContext {
  readonly policy: SecurityPolicy;
  readonly now: Date;
}

export interface Detector {
  readonly id: string;
  analyze(intent: TransactionIntent, context: DetectorContext): Promise<readonly RiskSignal[]>;
}

export interface DetectorRegistry {
  readonly detectors: readonly Detector[];
  get(id: string): Detector | undefined;
}
