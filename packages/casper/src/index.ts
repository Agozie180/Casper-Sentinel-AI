import type { RiskReport } from "@casper-sentinel/domain";

export const CasperPublicationStatus = {
  Queued: "queued",
  Submitted: "submitted",
  Confirmed: "confirmed",
  Failed: "failed"
} as const;

export type CasperPublicationStatus = (typeof CasperPublicationStatus)[keyof typeof CasperPublicationStatus];

export interface RiskReportAttestation extends RiskReport {
  readonly metadataHash: string;
}

export interface CasperPublisher {
  publish(report: RiskReportAttestation): Promise<CasperPublishResult>;
}

export interface CasperPublishResult {
  readonly status: CasperPublicationStatus;
  readonly transactionHash?: string;
  readonly errorMessage?: string;
}

/** Converts a report into the compact attestation shape intended for Casper Testnet storage. */
export function toRiskReportAttestation(report: RiskReport): RiskReportAttestation {
  return { ...report, metadataHash: report.metadataHash };
}
