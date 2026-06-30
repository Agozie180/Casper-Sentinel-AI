import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CasperPublicationUpdate, ReportRepository, ReportSummary, StoredRiskReport } from "./types.js";
import { applyCasperPublicationUpdate, toSummary } from "./in-memory-report-repository.js";

interface ReportStoreFile {
  readonly version: 1;
  readonly reports: readonly StoredRiskReport[];
}

/** Persists local MVP reports on disk while preserving the repository boundary. */
export class FileReportRepository implements ReportRepository {
  constructor(private readonly filePath: string) {}

  async save(report: StoredRiskReport): Promise<StoredRiskReport> {
    const reports = await this.readAll();
    const nextReports = [report, ...reports.filter((stored) => stored.id !== report.id)];
    await this.writeAll(nextReports);
    return report;
  }

  async list(): Promise<readonly ReportSummary[]> {
    const reports = await this.readAll();
    return reports.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(toSummary);
  }

  async findById(id: string): Promise<StoredRiskReport | undefined> {
    const reports = await this.readAll();
    return reports.find((report) => report.id === id);
  }

  async updateCasperPublication(
    id: string,
    update: CasperPublicationUpdate,
  ): Promise<StoredRiskReport | undefined> {
    const reports = await this.readAll();
    const existing = reports.find((report) => report.id === id);
    if (existing === undefined) return undefined;

    const updated = applyCasperPublicationUpdate(existing, update);
    await this.writeAll([updated, ...reports.filter((report) => report.id !== id)]);
    return updated;
  }

  private async readAll(): Promise<StoredRiskReport[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      if (content.trim().length === 0) return [];
      const parsed: unknown = JSON.parse(content);
      if (!isReportStoreFile(parsed)) {
        throw new Error(`Report store at ${this.filePath} does not match the expected schema.`);
      }
      return [...parsed.reports];
    } catch (error: unknown) {
      if (isErrnoException(error) && error.code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAll(reports: readonly StoredRiskReport[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    const payload: ReportStoreFile = { version: 1, reports };
    await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }
}

function isReportStoreFile(value: unknown): value is ReportStoreFile {
  const record = asRecord(value);
  return record !== undefined && record.version === 1 && Array.isArray(record.reports) && record.reports.every(isStoredRiskReport);
}

function isStoredRiskReport(value: unknown): value is StoredRiskReport {
  const record = asRecord(value);
  return (
    record !== undefined &&
    typeof record.id === "string" &&
    typeof record.traceId === "string" &&
    typeof record.walletAddress === "string" &&
    typeof record.target === "string" &&
    typeof record.transactionKind === "string" &&
    (record.transactionHash === undefined || typeof record.transactionHash === "string") &&
    typeof record.intentHash === "string" &&
    typeof record.riskScore === "number" &&
    typeof record.riskBand === "string" &&
    typeof record.confidence === "number" &&
    typeof record.decision === "string" &&
    typeof record.policyVersion === "string" &&
    asRecord(record.explanation) !== undefined &&
    typeof record.explanationHash === "string" &&
    typeof record.metadataHash === "string" &&
    typeof record.casperStatus === "string" &&
    (record.casperTransactionHash === undefined || typeof record.casperTransactionHash === "string") &&
    (record.casperErrorMessage === undefined || typeof record.casperErrorMessage === "string") &&
    Array.isArray(record.signals) &&
    Array.isArray(record.reasons) &&
    typeof record.requiredUserMessage === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
