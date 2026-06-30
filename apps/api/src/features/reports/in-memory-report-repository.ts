import type { CasperPublicationUpdate, ReportRepository, ReportSummary, StoredRiskReport } from "./types.js";

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

  updateCasperPublication(id: string, update: CasperPublicationUpdate): Promise<StoredRiskReport | undefined> {
    const report = this.#reports.get(id);
    if (report === undefined) return Promise.resolve(undefined);

    const updated = applyCasperPublicationUpdate(report, update);
    this.#reports.set(id, updated);
    return Promise.resolve(updated);
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
    ...(report.casperTransactionHash !== undefined ? { casperTransactionHash: report.casperTransactionHash } : {}),
    createdAt: report.createdAt,
  };
}

/** Applies a Casper publication status update without mutating the stored report. */
export function applyCasperPublicationUpdate(
  report: StoredRiskReport,
  update: CasperPublicationUpdate,
): StoredRiskReport {
  return {
    ...report,
    casperStatus: update.status,
    ...(update.transactionHash !== undefined ? { casperTransactionHash: update.transactionHash } : {}),
    ...(update.errorMessage !== undefined ? { casperErrorMessage: update.errorMessage } : {}),
    updatedAt: update.updatedAt,
  };
}
