import type { GroundedExplanation } from "@casper-sentinel/ai-agent";
import type { DecisionAction, RiskBand, RiskSignal, TransactionKind } from "@casper-sentinel/domain";

export type CasperPublicationStatus = "not_queued" | "queued" | "submitted" | "confirmed" | "failed";

export interface StoredRiskReport {
  readonly id: string;
  readonly traceId: string;
  readonly walletAddress: string;
  readonly target: string;
  readonly transactionKind: TransactionKind;
  readonly transactionHash?: string;
  readonly intentHash: string;
  readonly riskScore: number;
  readonly riskBand: RiskBand;
  readonly confidence: number;
  readonly decision: DecisionAction;
  readonly policyVersion: string;
  readonly explanation: GroundedExplanation;
  readonly explanationHash: string;
  readonly metadataHash: string;
  readonly casperStatus: CasperPublicationStatus;
  readonly casperTransactionHash?: string;
  readonly casperErrorMessage?: string;
  readonly casperPublicationIdempotencyKey?: string;
  readonly signals: readonly RiskSignal[];
  readonly reasons: readonly string[];
  readonly requiredUserMessage: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReportSummary {
  readonly id: string;
  readonly walletAddress: string;
  readonly target: string;
  readonly transactionKind: TransactionKind;
  readonly riskScore: number;
  readonly riskBand: RiskBand;
  readonly decision: DecisionAction;
  readonly policyVersion: string;
  readonly casperStatus: StoredRiskReport["casperStatus"];
  readonly casperTransactionHash?: string;
  readonly createdAt: string;
}

export interface CasperPublicationUpdate {
  readonly status: CasperPublicationStatus;
  readonly transactionHash?: string;
  readonly errorMessage?: string;
  readonly idempotencyKey?: string;
  readonly updatedAt: string;
}

export interface ReportRepository {
  save(report: StoredRiskReport): Promise<StoredRiskReport>;
  list(): Promise<readonly ReportSummary[]>;
  findById(id: string): Promise<StoredRiskReport | undefined>;
  updateCasperPublication(id: string, update: CasperPublicationUpdate): Promise<StoredRiskReport | undefined>;
}
