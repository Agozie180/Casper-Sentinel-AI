import type { ReportRepository, ReportSummary, StoredRiskReport } from "./types.js";

/** Stores reports in process memory for local MVP runs and API tests. */
export class InMemoryReportRepository implements ReportRepository {
  readonly #reports = new Map<string, StoredRiskReport>();

  save(report: StoredRiskReport): Promise<StoredRiskReport> {
    this.#reports.set(report.id, report);
    return Promise.resolve(report);
  }

  list(): Promise<readonly ReportSummary[]> {
    return Promise.resolve(
      [...this.#reports.values()]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(toSummary),
    );
  }

  findById(id: string): Promise<StoredRiskReport | undefined> {
    return Promise.resolve(this.#reports.get(id));
  }
}

/** Converts a full report into the list response shape. */
export function toSummary(report: StoredRiskReport): ReportSummary {
  return {
    id: report.id,
    walletAddress: report.walletAddress,
    target: report.target,
    transactionKind: report.transactionKind,
    riskScore: report.riskScore,
    riskBand: report.riskBand,
    decision: report.decision,
    policyVersion: report.policyVersion,
    casperStatus: report.casperStatus,
    createdAt: report.createdAt,
  };
}
