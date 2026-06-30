import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { StoredRiskReport } from "./types.js";
import { FileReportRepository } from "./file-report-repository.js";

function buildStoredReport(id: string, createdAt: string): StoredRiskReport {
  return {
    id,
    traceId: `trace-${id}`,
    walletAddress: "account-hash-wallet",
    target: "hash-trusted-contract",
    transactionKind: "TRANSFER",
    intentHash: `intent-${id}`,
    riskScore: 4,
    riskBand: "LOW",
    confidence: 0.95,
    decision: "APPROVE",
    policyVersion: "mvp-2026-06",
    explanation: {
      observedEvidence: ["No high-risk detector fired."],
      inferredRisk: ["Transfer risk is low."],
      recommendation: "Proceed with normal signing controls.",
      confidence: 0.95,
      source: "fallback",
      promptVersion: "sentinel-analyst-v1",
      explanationHash: `explanation-${id}`,
    },
    explanationHash: `explanation-${id}`,
    metadataHash: `metadata-${id}`,
    casperStatus: "not_queued",
    signals: [],
    reasons: ["No high-risk detector fired."],
    requiredUserMessage: "No additional confirmation required.",
    createdAt,
    updatedAt: createdAt,
  };
}

describe("FileReportRepository", () => {
  it("saves reports to disk and reads them from a new repository instance", async () => {
    const directory = await mkdtemp(join(tmpdir(), "casper-sentinel-reports-"));
    const filePath = join(directory, "risk-reports.json");

    try {
      const firstRepository = new FileReportRepository(filePath);
      await firstRepository.save(buildStoredReport("older", "2026-06-29T00:00:00.000Z"));
      await firstRepository.save(buildStoredReport("newer", "2026-06-30T00:00:00.000Z"));

      const secondRepository = new FileReportRepository(filePath);

      await expect(secondRepository.findById("newer")).resolves.toMatchObject({ id: "newer", decision: "APPROVE" });
      await expect(secondRepository.list()).resolves.toMatchObject([{ id: "newer" }, { id: "older" }]);
      await expect(
        secondRepository.updateCasperPublication("newer", {
          status: "submitted",
          transactionHash: "deploy-hash-newer",
          updatedAt: "2026-06-30T00:01:00.000Z",
        }),
      ).resolves.toMatchObject({ casperStatus: "submitted", casperTransactionHash: "deploy-hash-newer" });

      const thirdRepository = new FileReportRepository(filePath);
      await expect(thirdRepository.findById("newer")).resolves.toMatchObject({
        casperStatus: "submitted",
        casperTransactionHash: "deploy-hash-newer",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

