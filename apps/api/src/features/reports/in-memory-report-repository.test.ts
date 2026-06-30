import { describe, expect, it } from "vitest";
import {
  buildBlockingApprovalIntent,
  buildMvpPolicy,
  buildSafeTransferIntent,
} from "@casper-sentinel/testkit";
import { analyzeTransaction, toTransactionIntent } from "../screening/analyze-transaction.js";
import type { AnalyzeRequestBody } from "../screening/schemas.js";
import { InMemoryReportRepository } from "./in-memory-report-repository.js";
import { createStoredRiskReport } from "./report-factory.js";

function buildPolicyPayload(): AnalyzeRequestBody["policy"] {
  const policy = buildMvpPolicy();
  return {
    version: policy.version,
    warnScore: policy.warnScore,
    blockScore: policy.blockScore,
    highValueMotes: policy.highValueMotes,
    blockValueMotes: policy.blockValueMotes,
    maxApprovalMotes: policy.maxApprovalMotes,
    allowlistedTargets: [...policy.allowlistedTargets],
    denylistedTargets: [...policy.denylistedTargets],
    denylistedWallets: [...policy.denylistedWallets],
    knownContracts: Object.fromEntries(
      Object.entries(policy.knownContracts).map(([key, metadata]) => [
        key,
        {
          verified: metadata.verified,
          ...(metadata.name !== undefined ? { name: metadata.name } : {}),
          ...(metadata.allowedEntryPoints !== undefined
            ? { allowedEntryPoints: [...metadata.allowedEntryPoints] }
            : {}),
        },
      ]),
    ),
  };
}

describe("InMemoryReportRepository", () => {
  it("saves, lists, and finds reports", async () => {
    const repository = new InMemoryReportRepository();
    const now = new Date("2026-06-30T00:00:00Z");
    const safeRequest = { intent: buildSafeTransferIntent(), policy: buildPolicyPayload() };
    const blockRequest = { intent: buildBlockingApprovalIntent(), policy: buildPolicyPayload() };

    const safeAnalysis = await analyzeTransaction(safeRequest, "trace-safe", { now: () => now });
    const blockAnalysis = await analyzeTransaction(blockRequest, "trace-block", { now: () => now });
    const safeReport = await repository.save(
      createStoredRiskReport(safeAnalysis, toTransactionIntent(safeRequest.intent), now),
    );
    const blockReport = await repository.save(
      createStoredRiskReport(blockAnalysis, toTransactionIntent(blockRequest.intent), now),
    );

    await expect(repository.findById(safeReport.id)).resolves.toMatchObject({ decision: "APPROVE" });
    await expect(repository.findById(blockReport.id)).resolves.toMatchObject({ decision: "BLOCK" });
    await expect(repository.list()).resolves.toHaveLength(2);

    await expect(
      repository.updateCasperPublication(safeReport.id, {
        status: "confirmed",
        transactionHash: "deploy-hash-safe",
        updatedAt: "2026-06-30T00:01:00.000Z",
      }),
    ).resolves.toMatchObject({ casperStatus: "confirmed", casperTransactionHash: "deploy-hash-safe" });
  });
});

