export const DecisionAction = {
  Approve: "APPROVE",
  Warn: "WARN",
  Block: "BLOCK",
} as const;
export type DecisionAction = (typeof DecisionAction)[keyof typeof DecisionAction];

export const RiskBand = {
  Low: "LOW",
  Medium: "MEDIUM",
  High: "HIGH",
  Critical: "CRITICAL",
} as const;
export type RiskBand = (typeof RiskBand)[keyof typeof RiskBand];

export const TransactionKind = {
  Transfer: "TRANSFER",
  ContractCall: "CONTRACT_CALL",
  Approval: "APPROVAL",
  Unknown: "UNKNOWN",
} as const;
export type TransactionKind = (typeof TransactionKind)[keyof typeof TransactionKind];

export const RiskSignalImpact = {
  ScoreOnly: "SCORE_ONLY",
  Warn: "WARN",
  HardBlock: "HARD_BLOCK",
} as const;
export type RiskSignalImpact = (typeof RiskSignalImpact)[keyof typeof RiskSignalImpact];

export interface ApprovalScope {
  readonly spender: string;
  readonly allowanceMotes?: string;
  readonly unlimited?: boolean;
}

export interface TransactionIntent {
  readonly walletAddress: string;
  readonly chainName: "casper-testnet" | "casper-mainnet" | "unknown";
  readonly transactionKind: TransactionKind;
  readonly target: string;
  readonly entryPoint?: string;
  readonly amountMotes?: string;
  readonly approvalScope?: ApprovalScope;
  readonly args: Readonly<Record<string, unknown>>;
  readonly rawTransaction?: unknown;
  readonly clientContext: Readonly<Record<string, unknown>>;
}

export interface RiskEvidence {
  readonly label: string;
  readonly value: string;
  readonly source: "intent" | "wallet-context" | "contract-context" | "policy" | "inference";
}

export interface RiskSignal {
  readonly id: string;
  readonly detectorId: string;
  readonly category: "contract" | "wallet" | "approval" | "anomaly" | "policy" | "simulation" | "input";
  readonly severity: number;
  readonly confidence: number;
  readonly weight: number;
  readonly impact: RiskSignalImpact;
  readonly observed: readonly string[];
  readonly inferred: readonly string[];
  readonly evidence: readonly RiskEvidence[];
}

export interface RiskScore {
  readonly value: number;
  readonly band: RiskBand;
  readonly confidence: number;
  readonly signals: readonly RiskSignal[];
}

export interface Decision {
  readonly action: DecisionAction;
  readonly score: RiskScore;
  readonly reasons: readonly string[];
  readonly policyVersion: string;
  readonly requiredUserMessage: string;
}

export interface RiskReport {
  readonly id: string;
  readonly walletAddress: string;
  readonly transactionHash?: string;
  readonly timestamp: string;
  readonly riskScore: number;
  readonly decision: DecisionAction;
  readonly explanationHash: string;
  readonly metadataHash: string;
}

export interface ContractMetadata {
  readonly name?: string;
  readonly verified: boolean;
  readonly allowedEntryPoints?: readonly string[];
}

export interface SecurityPolicy {
  readonly version: string;
  readonly warnScore: number;
  readonly blockScore: number;
  readonly highValueMotes: string;
  readonly blockValueMotes: string;
  readonly maxApprovalMotes: string;
  readonly allowlistedTargets: readonly string[];
  readonly denylistedTargets: readonly string[];
  readonly denylistedWallets: readonly string[];
  readonly knownContracts: Readonly<Record<string, ContractMetadata>>;
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  version: "mvp-2026-06-30",
  warnScore: 40,
  blockScore: 80,
  highValueMotes: "100000000000",
  blockValueMotes: "1000000000000",
  maxApprovalMotes: "500000000000",
  allowlistedTargets: [],
  denylistedTargets: [],
  denylistedWallets: [],
  knownContracts: {},
};

/** Returns true when a value is one of the supported autonomous decision actions. */
export function isDecisionAction(value: unknown): value is DecisionAction {
  return Object.values(DecisionAction).includes(value as DecisionAction);
}

/** Validates that a risk score is inside the inclusive 0 to 100 range used across the system. */
export function assertRiskScoreValue(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError("Risk score must be a finite number between 0 and 100.");
  }
}

/** Maps a numeric risk score into the band shown to users and policy code. */
export function riskBandForScore(value: number): RiskBand {
  assertRiskScoreValue(value);
  if (value >= 90) return RiskBand.Critical;
  if (value >= 70) return RiskBand.High;
  if (value >= 40) return RiskBand.Medium;
  return RiskBand.Low;
}

/** Returns a copy of the default MVP policy with explicit overrides applied. */
export function createSecurityPolicy(overrides: Partial<SecurityPolicy> = {}): SecurityPolicy {
  return {
    ...DEFAULT_SECURITY_POLICY,
    ...overrides,
    allowlistedTargets: overrides.allowlistedTargets ?? DEFAULT_SECURITY_POLICY.allowlistedTargets,
    denylistedTargets: overrides.denylistedTargets ?? DEFAULT_SECURITY_POLICY.denylistedTargets,
    denylistedWallets: overrides.denylistedWallets ?? DEFAULT_SECURITY_POLICY.denylistedWallets,
    knownContracts: overrides.knownContracts ?? DEFAULT_SECURITY_POLICY.knownContracts,
  };
}
