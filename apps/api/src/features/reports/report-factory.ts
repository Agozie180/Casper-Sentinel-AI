import { createHash, randomUUID } from "node:crypto";
import type { TransactionIntent } from "@casper-sentinel/domain";
import type { AnalyzeTransactionResponse } from "../screening/analyze-transaction.js";
import type { StoredRiskReport } from "./types.js";

/** Creates the stored audit report for an analysis response. */
export function createStoredRiskReport(
  analysis: AnalyzeTransactionResponse,
  intent: TransactionIntent,
  now: Date,
): StoredRiskReport {
  const createdAt = now.toISOString();
  const intentHash = sha256(stableStringify(intent));
  const metadataHash = sha256(
    stableStringify({
      traceId: analysis.traceId,
      policyVersion: analysis.policyVersion,
      signalIds: analysis.signals.map((signal) => signal.id),
    }),
  );

  return {
    id: randomUUID(),
    traceId: analysis.traceId,
    walletAddress: intent.walletAddress,
    target: intent.target,
    transactionKind: intent.transactionKind,
    intentHash,
    riskScore: analysis.riskScore.value,
    riskBand: analysis.riskScore.band,
    confidence: analysis.riskScore.confidence,
    decision: analysis.decision,
    policyVersion: analysis.policyVersion,
    explanation: analysis.explanation,
    explanationHash: analysis.explanationHash,
    metadataHash,
    casperStatus: "not_queued",
    signals: analysis.signals,
    reasons: analysis.reasons,
    requiredUserMessage: analysis.requiredUserMessage,
    createdAt,
    updatedAt: createdAt,
  };
}

/** Hashes report content using SHA-256 for later on-chain attestation fields. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
