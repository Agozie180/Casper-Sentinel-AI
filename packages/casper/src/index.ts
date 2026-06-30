import type { DecisionAction, RiskReport } from "@casper-sentinel/domain";

export const CasperPublicationStatus = {
  NotQueued: "not_queued",
  Queued: "queued",
  Submitted: "submitted",
  Confirmed: "confirmed",
  Failed: "failed",
} as const;

export type CasperPublicationStatus = (typeof CasperPublicationStatus)[keyof typeof CasperPublicationStatus];

export interface RiskReportAttestation {
  readonly reportId: string;
  readonly walletAddress: string;
  readonly transactionHash?: string;
  readonly timestamp: string;
  readonly riskScore: number;
  readonly decision: DecisionAction;
  readonly explanationHash: string;
  readonly metadataHash: string;
}

export interface RecordReportDeployCall {
  readonly contractHash: string;
  readonly entryPoint: "record_report";
  readonly args: {
    readonly report_id: string;
    readonly wallet_address: string;
    readonly transaction_hash?: string;
    readonly timestamp: string;
    readonly risk_score: number;
    readonly decision: DecisionAction;
    readonly explanation_hash: string;
    readonly metadata_hash: string;
  };
}

export interface CasperPublishResult {
  readonly status: Exclude<CasperPublicationStatus, "not_queued" | "queued">;
  readonly transactionHash?: string;
  readonly errorMessage?: string;
}

export interface CasperDeployConfirmation {
  readonly transactionHash: string;
  readonly confirmed: boolean;
}

export interface CasperDeployGateway {
  submitRecordReport(attestation: RiskReportAttestation, deployCall: RecordReportDeployCall): Promise<string>;
  waitForConfirmation(transactionHash: string): Promise<CasperDeployConfirmation>;
}

export interface CasperReportPublisherOptions {
  readonly contractHash: string;
  readonly gateway: CasperDeployGateway;
}

export interface CasperPublisher {
  publish(report: RiskReportAttestation): Promise<CasperPublishResult>;
}

/** Publishes compact report attestations through an injected Casper deploy gateway. */
export class CasperReportPublisher implements CasperPublisher {
  constructor(private readonly options: CasperReportPublisherOptions) {}

  async publish(report: RiskReportAttestation): Promise<CasperPublishResult> {
    try {
      assertValidAttestation(report);
      const deployCall = buildRecordReportDeployCall(report, this.options.contractHash);
      const transactionHash = await this.options.gateway.submitRecordReport(report, deployCall);
      const confirmation = await this.options.gateway.waitForConfirmation(transactionHash);

      if (confirmation.confirmed) {
        return { status: CasperPublicationStatus.Confirmed, transactionHash: confirmation.transactionHash };
      }

      return { status: CasperPublicationStatus.Submitted, transactionHash };
    } catch (error: unknown) {
      return {
        status: CasperPublicationStatus.Failed,
        errorMessage: error instanceof Error ? error.message : "Casper publication failed.",
      };
    }
  }
}

/** Converts a report into the compact attestation shape intended for Casper Testnet storage. */
export function toRiskReportAttestation(report: RiskReport): RiskReportAttestation {
  return {
    reportId: report.id,
    walletAddress: report.walletAddress,
    ...(report.transactionHash !== undefined ? { transactionHash: report.transactionHash } : {}),
    timestamp: report.timestamp,
    riskScore: report.riskScore,
    decision: report.decision,
    explanationHash: report.explanationHash,
    metadataHash: report.metadataHash,
  };
}

/** Builds the exact contract-call payload for the `record_report` entry point. */
export function buildRecordReportDeployCall(
  report: RiskReportAttestation,
  contractHash: string,
): RecordReportDeployCall {
  if (contractHash.trim().length === 0) {
    throw new Error("CASPER_RISK_REPORT_CONTRACT_HASH is required before publishing reports.");
  }
  assertValidAttestation(report);

  return {
    contractHash,
    entryPoint: "record_report",
    args: {
      report_id: report.reportId,
      wallet_address: report.walletAddress,
      ...(report.transactionHash !== undefined ? { transaction_hash: report.transactionHash } : {}),
      timestamp: report.timestamp,
      risk_score: report.riskScore,
      decision: report.decision,
      explanation_hash: report.explanationHash,
      metadata_hash: report.metadataHash,
    },
  };
}

/** Validates a compact report attestation before it can be handed to a Casper gateway. */
export function assertValidAttestation(report: RiskReportAttestation): void {
  if (report.reportId.trim().length === 0) throw new Error("Report id is required for Casper publication.");
  if (report.walletAddress.trim().length === 0) throw new Error("Wallet address is required for Casper publication.");
  if (report.transactionHash !== undefined && report.transactionHash.trim().length === 0) {
    throw new Error("Transaction hash must be omitted instead of blank.");
  }
  if (!Number.isInteger(report.riskScore) || report.riskScore < 0 || report.riskScore > 100) {
    throw new Error("Risk score must be an integer between 0 and 100.");
  }
  if (Number.isNaN(Date.parse(report.timestamp))) throw new Error("Timestamp must be an ISO date string.");
  if (report.explanationHash.trim().length === 0) throw new Error("Explanation hash is required.");
  if (report.metadataHash.trim().length === 0) throw new Error("Metadata hash is required.");
}
