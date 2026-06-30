import { CasperPublicationStatus, toRiskReportAttestation, type CasperPublisher } from "@casper-sentinel/casper";
import type { DecisionAction } from "@casper-sentinel/domain";
import { loadConfig } from "@casper-sentinel/config";

export interface PublishableRiskReport {
  readonly id: string;
  readonly walletAddress: string;
  readonly transactionHash?: string;
  readonly createdAt: string;
  readonly riskScore: number;
  readonly decision: DecisionAction;
  readonly explanationHash: string;
  readonly metadataHash: string;
  readonly casperStatus: "queued" | "submitted" | "confirmed" | "failed" | "not_queued";
}

export interface PublicationUpdate {
  readonly status: "submitted" | "confirmed" | "failed";
  readonly transactionHash?: string;
  readonly errorMessage?: string;
  readonly updatedAt: string;
}

export interface PublicationReportRepository {
  listQueued(): Promise<readonly PublishableRiskReport[]>;
  updateCasperPublication(id: string, update: PublicationUpdate): Promise<void>;
}

export interface PublishQueuedReportsOptions {
  readonly repository: PublicationReportRepository;
  readonly publisher: CasperPublisher;
  readonly now?: () => Date;
}

export interface PublishQueuedReportsSummary {
  readonly attempted: number;
  readonly submitted: number;
  readonly confirmed: number;
  readonly failed: number;
}

/** Publishes queued reports and persists the resulting Casper publication state. */
export async function publishQueuedReports(
  options: PublishQueuedReportsOptions,
): Promise<PublishQueuedReportsSummary> {
  const queuedReports = await options.repository.listQueued();
  const summary = { attempted: 0, submitted: 0, confirmed: 0, failed: 0 };

  for (const report of queuedReports) {
    summary.attempted += 1;
    const result = await options.publisher.publish(
      toRiskReportAttestation({
        id: report.id,
        walletAddress: report.walletAddress,
        ...(report.transactionHash !== undefined ? { transactionHash: report.transactionHash } : {}),
        timestamp: report.createdAt,
        riskScore: report.riskScore,
        decision: report.decision,
        explanationHash: report.explanationHash,
        metadataHash: report.metadataHash,
      }),
    );

    if (result.status === CasperPublicationStatus.Confirmed) summary.confirmed += 1;
    if (result.status === CasperPublicationStatus.Submitted) summary.submitted += 1;
    if (result.status === CasperPublicationStatus.Failed) summary.failed += 1;

    await options.repository.updateCasperPublication(report.id, {
      status: result.status,
      ...(result.transactionHash !== undefined ? { transactionHash: result.transactionHash } : {}),
      ...(result.errorMessage !== undefined ? { errorMessage: result.errorMessage } : {}),
      updatedAt: (options.now?.() ?? new Date()).toISOString(),
    });
  }

  return summary;
}

/** Starts background workers for asynchronous Casper publication jobs. */
export function startWorker(): void {
  const config = loadConfig();
  console.info("casper-sentinel-worker ready", {
    casperNetwork: config.casperNetwork,
    casperContractConfigured: config.casperRiskReportContractHash !== undefined,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    startWorker();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}
