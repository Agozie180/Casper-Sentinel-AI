import { describe, expect, it } from "vitest";
import {
  buildBlockingApprovalIntent,
  buildMvpPolicy,
  buildSafeTransferIntent,
  buildWarningContractCallIntent,
} from "@casper-sentinel/testkit";
import { analyzeTransaction } from "./analyze-transaction.js";
import type { AnalyzeRequestBody } from "./schemas.js";

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

describe("analyzeTransaction", () => {
  it("returns an approve decision with a deterministic explanation", async () => {
    const response = await analyzeTransaction(
      { intent: buildSafeTransferIntent(), policy: buildPolicyPayload() },
      "trace-safe",
      { now: () => new Date("2026-06-30T00:00:00Z") },
    );

    expect(response).toMatchObject({
      traceId: "trace-safe",
      decision: "APPROVE",
      riskScore: { value: 0, band: "LOW" },
      casperPublication: { status: "queued" },
    });
    expect(response.explanation.observedEvidence[0]).toContain("No detector");
  });

  it("returns warning decisions for risky but non-blocked transactions", async () => {
    const response = await analyzeTransaction(
      { intent: buildWarningContractCallIntent(), policy: buildPolicyPayload() },
      "trace-warn",
    );

    expect(response.decision).toBe("WARN");
    expect(response.signals.length).toBeGreaterThan(0);
    expect(response.explanation.inferredRisk.length).toBeGreaterThan(0);
  });

  it("returns block decisions for hard policy violations", async () => {
    const response = await analyzeTransaction(
      { intent: buildBlockingApprovalIntent(), policy: buildPolicyPayload() },
      "trace-block",
    );

    expect(response.decision).toBe("BLOCK");
    expect(response.reasons.join(" ")).toContain("denylist");
    expect(response.casperPublication.reason).toContain("no transaction hash is claimed");
  });
});


