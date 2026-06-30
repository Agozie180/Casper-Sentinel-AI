import { describe, expect, it } from "vitest";
import {
  buildBlockingApprovalIntent,
  buildMvpPolicy,
  buildSafeTransferIntent,
  buildWarningContractCallIntent,
} from "@casper-sentinel/testkit";
import type { AnalyzeTransactionResponse } from "./analyze-transaction.js";
import type { ErrorResponse } from "./routes.js";
import { buildServer } from "../../main.js";

type JsonPayload = Record<string, unknown>;
type AnalyzeApiResponse = AnalyzeTransactionResponse & {
  readonly reportId: string;
  readonly createdAt: string;
};

function buildPolicyPayload(): JsonPayload {
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

async function injectAnalyze(payload: JsonPayload) {
  const server = buildServer({ now: () => new Date("2026-06-30T00:00:00Z") });
  await server.ready();
  const response = await server.inject({ method: "POST", url: "/v1/analyze", payload });
  await server.close();
  return response;
}

function parseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

describe("screening routes", () => {
  it("serves health checks", async () => {
    const server = buildServer();
    await server.ready();
    const response = await server.inject({ method: "GET", url: "/v1/health" });
    await server.close();

    expect(response.statusCode).toBe(200);
    expect(parseJson<Record<string, string>>(response.body)).toMatchObject({
      status: "ok",
      service: "casper-sentinel-api",
    });
  });

  it("approves safe transaction intents and returns a saved report id", async () => {
    const response = await injectAnalyze({ intent: buildSafeTransferIntent(), policy: buildPolicyPayload() });
    const body = parseJson<AnalyzeApiResponse>(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      decision: "APPROVE",
      riskScore: { value: 0, band: "LOW" },
      policyVersion: "test-mvp-policy",
      casperPublication: { status: "queued" },
    });
    expect(body.reportId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof body.traceId).toBe("string");
    expect(body.explanationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("warns on unknown high-value contract calls", async () => {
    const response = await injectAnalyze({
      intent: buildWarningContractCallIntent(),
      policy: buildPolicyPayload(),
    });
    const body = parseJson<AnalyzeApiResponse>(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.decision).toBe("WARN");
    expect(body.signals.map((signal) => signal.detectorId)).toContain("target");
  });

  it("blocks hard policy violations", async () => {
    const response = await injectAnalyze({
      intent: buildBlockingApprovalIntent(),
      policy: buildPolicyPayload(),
    });
    const body = parseJson<AnalyzeApiResponse>(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.decision).toBe("BLOCK");
    expect(body.signals.some((signal) => signal.impact === "HARD_BLOCK")).toBe(true);
  });

  it("returns provider-backed explanations without changing the deterministic decision", async () => {
    const server = buildServer({
      now: () => new Date("2026-06-30T00:00:00Z"),
      aiProvider: {
        explain: () =>
          Promise.resolve({
            observedEvidence: ["The target appears in supplied detector evidence."],
            inferredRisk: ["The transaction deserves review based on supplied signals."],
            recommendation: "Warn the user before signing.",
            confidence: 0.88,
          }),
      },
    });
    await server.ready();
    const response = await server.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { intent: buildWarningContractCallIntent(), policy: buildPolicyPayload() },
    });
    await server.close();
    const body = parseJson<AnalyzeApiResponse>(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.decision).toBe("WARN");
    expect(body.explanation.source).toBe("provider");
    expect(body.explanationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("lists and fetches saved reports from the same server instance", async () => {
    const server = buildServer({ now: () => new Date("2026-06-30T00:00:00Z") });
    await server.ready();

    const analyzeResponse = await server.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { intent: buildWarningContractCallIntent(), policy: buildPolicyPayload() },
    });
    const analyzed = parseJson<AnalyzeApiResponse>(analyzeResponse.body);
    const listResponse = await server.inject({ method: "GET", url: "/v1/reports" });
    const detailResponse = await server.inject({ method: "GET", url: `/v1/reports/${analyzed.reportId}` });
    await server.close();

    expect(listResponse.statusCode).toBe(200);
    expect(parseJson<{ reports: readonly { id: string }[] }>(listResponse.body).reports[0]?.id).toBe(
      analyzed.reportId,
    );
    expect(detailResponse.statusCode).toBe(200);
    expect(parseJson<{ report: { id: string; decision: string } }>(detailResponse.body).report).toMatchObject({
      id: analyzed.reportId,
      decision: "WARN",
    });
  });

  it("returns structured validation errors for invalid input", async () => {
    const response = await injectAnalyze({
      intent: {
        ...buildSafeTransferIntent(),
        transactionKind: "SEND_EVERYTHING",
      },
    });
    const body = parseJson<ErrorResponse>(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request body failed validation.",
    });
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("returns structured not-found errors for missing reports", async () => {
    const server = buildServer();
    await server.ready();
    const response = await server.inject({ method: "GET", url: "/v1/reports/missing" });
    await server.close();
    const body = parseJson<ErrorResponse>(response.body);

    expect(response.statusCode).toBe(404);
    expect(body.error.code).toBe("REPORT_NOT_FOUND");
  });

  it("queues an existing report for Casper publication without fabricating a transaction hash", async () => {
    const server = buildServer({ now: () => new Date("2026-06-30T00:00:00Z") });
    await server.ready();

    const analyzeResponse = await server.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { intent: buildWarningContractCallIntent(), policy: buildPolicyPayload() },
    });
    const analyzed = parseJson<AnalyzeApiResponse>(analyzeResponse.body);
    const publishResponse = await server.inject({
      method: "POST",
      url: `/v1/casper/reports/${analyzed.reportId}/publish`,
      headers: { "idempotency-key": "demo-publication-1" },
    });
    await server.close();

    expect(publishResponse.statusCode).toBe(202);
    expect(parseJson<{ report: { casperStatus: string; casperTransactionHash?: string } }>(publishResponse.body).report).toEqual(
      expect.objectContaining({ casperStatus: "queued" }),
    );
    expect(
      parseJson<{ report: { casperTransactionHash?: string; casperPublicationIdempotencyKey?: string } }>(publishResponse.body).report,
    ).toMatchObject({ casperPublicationIdempotencyKey: "demo-publication-1" });
    expect(
      parseJson<{ report: { casperTransactionHash?: string } }>(publishResponse.body).report.casperTransactionHash,
    ).toBeUndefined();
  });
  it("treats repeated publication requests with the same idempotency key as safe retries", async () => {
    const server = buildServer({ now: () => new Date("2026-06-30T00:00:00Z") });
    await server.ready();

    const analyzeResponse = await server.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { intent: buildWarningContractCallIntent(), policy: buildPolicyPayload() },
    });
    const analyzed = parseJson<AnalyzeApiResponse>(analyzeResponse.body);
    const first = await server.inject({
      method: "POST",
      url: `/v1/casper/reports/${analyzed.reportId}/publish`,
      headers: { "idempotency-key": "retry-key" },
    });
    const second = await server.inject({
      method: "POST",
      url: `/v1/casper/reports/${analyzed.reportId}/publish`,
      headers: { "idempotency-key": "retry-key" },
    });
    await server.close();

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(parseJson<{ report: { casperPublicationIdempotencyKey?: string } }>(second.body).report).toMatchObject({
      casperPublicationIdempotencyKey: "retry-key",
    });
  });

  it("rejects competing publication idempotency keys while a report is queued", async () => {
    const server = buildServer({ now: () => new Date("2026-06-30T00:00:00Z") });
    await server.ready();

    const analyzeResponse = await server.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { intent: buildWarningContractCallIntent(), policy: buildPolicyPayload() },
    });
    const analyzed = parseJson<AnalyzeApiResponse>(analyzeResponse.body);
    await server.inject({
      method: "POST",
      url: `/v1/casper/reports/${analyzed.reportId}/publish`,
      headers: { "idempotency-key": "first-key" },
    });
    const conflict = await server.inject({
      method: "POST",
      url: `/v1/casper/reports/${analyzed.reportId}/publish`,
      headers: { "idempotency-key": "second-key" },
    });
    await server.close();

    expect(conflict.statusCode).toBe(409);
    expect(parseJson<ErrorResponse>(conflict.body).error.code).toBe("PUBLICATION_ALREADY_QUEUED");
  });});



