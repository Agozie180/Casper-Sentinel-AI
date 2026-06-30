import { createHash } from "node:crypto";
import type { Decision, RiskScore, RiskSignal, TransactionIntent } from "@casper-sentinel/domain";

export const analystPromptVersion = "sentinel-analyst-v1";

export interface ExplanationRequest {
  readonly intent: TransactionIntent;
  readonly score: RiskScore;
  readonly decision: Decision;
}

export interface ExplanationResult {
  readonly observedEvidence: readonly string[];
  readonly inferredRisk: readonly string[];
  readonly recommendation: string;
  readonly confidence: number;
}

export interface GroundedExplanation extends ExplanationResult {
  readonly source: "provider" | "fallback";
  readonly promptVersion: string;
  readonly explanationHash: string;
  readonly providerError?: string;
}

export interface SanitizedIntentSummary {
  readonly walletAddress: string;
  readonly chainName: TransactionIntent["chainName"];
  readonly transactionKind: TransactionIntent["transactionKind"];
  readonly target: string;
  readonly entryPoint?: string;
  readonly amountMotes?: string;
  readonly approvalScope?: {
    readonly spender: string;
    readonly allowanceMotes?: string;
    readonly unlimited?: boolean;
  };
  readonly args: Readonly<Record<string, unknown>>;
  readonly clientContext: Readonly<Record<string, unknown>>;
}

export interface SanitizedRiskSignal {
  readonly id: string;
  readonly detectorId: string;
  readonly category: RiskSignal["category"];
  readonly severity: number;
  readonly confidence: number;
  readonly impact: RiskSignal["impact"];
  readonly observed: readonly string[];
  readonly inferred: readonly string[];
  readonly evidence: readonly Readonly<Record<string, string>>[];
}

export interface SanitizedExplanationRequest {
  readonly intent: SanitizedIntentSummary;
  readonly score: {
    readonly value: number;
    readonly band: RiskScore["band"];
    readonly confidence: number;
  };
  readonly decision: {
    readonly action: Decision["action"];
    readonly reasons: readonly string[];
    readonly requiredUserMessage: string;
    readonly policyVersion: string;
  };
  readonly signals: readonly SanitizedRiskSignal[];
}

export interface AnalystPrompt {
  readonly version: string;
  readonly system: string;
  readonly user: string;
  readonly responseContract: Readonly<Record<string, unknown>>;
}

export interface AIAnalystProvider {
  explain(prompt: AnalystPrompt): Promise<unknown>;
}

export interface AIAnalystOptions {
  readonly provider?: AIAnalystProvider;
  readonly promptVersion?: string;
}

export interface AIAnalyst {
  explain(request: ExplanationRequest): Promise<GroundedExplanation>;
}

/** Creates the grounded AI analyst service with deterministic fallback behavior. */
export function createAIAnalyst(options: AIAnalystOptions = {}): AIAnalyst {
  const promptVersion = options.promptVersion ?? analystPromptVersion;

  return {
    async explain(request: ExplanationRequest): Promise<GroundedExplanation> {
      const sanitized = sanitizeExplanationRequest(request);
      const prompt = buildAnalystPrompt(sanitized, promptVersion);

      if (options.provider === undefined) {
        return withHash(createDeterministicExplanation(request), "fallback", promptVersion);
      }

      try {
        const providerOutput = await options.provider.explain(prompt);
        return withHash(parseExplanationResult(providerOutput), "provider", promptVersion);
      } catch (error) {
        const providerError = error instanceof Error ? error.message : "AI provider failed.";
        return withHash(createDeterministicExplanation(request), "fallback", promptVersion, providerError);
      }
    },
  };
}

/** Builds a deterministic explanation for local development and AI-provider failure handling. */
export function createDeterministicExplanation(request: ExplanationRequest): ExplanationResult {
  const observedEvidence = request.score.signals.flatMap((signal) => signal.observed);
  const inferredRisk = request.score.signals.flatMap((signal) => signal.inferred);

  return {
    observedEvidence:
      observedEvidence.length > 0 ? observedEvidence : ["No detector emitted high-risk evidence."],
    inferredRisk: inferredRisk.length > 0 ? inferredRisk : ["No additional inferred risk was found."],
    recommendation: request.decision.requiredUserMessage,
    confidence: request.score.confidence,
  };
}

/** Sanitizes request data before it is sent to an AI provider. */
export function sanitizeExplanationRequest(request: ExplanationRequest): SanitizedExplanationRequest {
  return {
    intent: {
      walletAddress: trimText(request.intent.walletAddress),
      chainName: request.intent.chainName,
      transactionKind: request.intent.transactionKind,
      target: trimText(request.intent.target),
      ...(request.intent.entryPoint !== undefined ? { entryPoint: trimText(request.intent.entryPoint) } : {}),
      ...(request.intent.amountMotes !== undefined ? { amountMotes: request.intent.amountMotes } : {}),
      ...(request.intent.approvalScope !== undefined
        ? {
            approvalScope: {
              spender: trimText(request.intent.approvalScope.spender),
              ...(request.intent.approvalScope.allowanceMotes !== undefined
                ? { allowanceMotes: request.intent.approvalScope.allowanceMotes }
                : {}),
              ...(request.intent.approvalScope.unlimited !== undefined
                ? { unlimited: request.intent.approvalScope.unlimited }
                : {}),
            },
          }
        : {}),
      args: sanitizeRecord(request.intent.args),
      clientContext: sanitizeRecord(request.intent.clientContext),
    },
    score: {
      value: request.score.value,
      band: request.score.band,
      confidence: request.score.confidence,
    },
    decision: {
      action: request.decision.action,
      reasons: request.decision.reasons.map(trimText),
      requiredUserMessage: trimText(request.decision.requiredUserMessage),
      policyVersion: trimText(request.decision.policyVersion),
    },
    signals: request.score.signals.map(toSanitizedSignal),
  };
}

/** Builds the provider prompt and response contract from sanitized evidence. */
export function buildAnalystPrompt(
  request: SanitizedExplanationRequest,
  version = analystPromptVersion,
): AnalystPrompt {
  return {
    version,
    system: [
      "You are Casper Sentinel AI, an autonomous blockchain security analyst.",
      "Explain only from the supplied structured evidence.",
      "Never invent wallet balances, chain state, contract behavior, or transaction success.",
      "Separate observed evidence from inferred risk.",
      "Do not change the supplied approve, warn, or block decision.",
    ].join(" "),
    user: JSON.stringify(request),
    responseContract: {
      observedEvidence: "string[] using only supplied observations",
      inferredRisk: "string[] clearly labeled as inference from supplied signals",
      recommendation: "string that matches the supplied decision and required user message",
      confidence: "number between 0 and 1",
    },
  };
}

/** Validates unknown provider output into the explanation result contract. */
export function parseExplanationResult(output: unknown): ExplanationResult {
  if (!isRecord(output)) {
    throw new TypeError("AI explanation output must be an object.");
  }

  const observedEvidence = parseStringArray(output.observedEvidence, "observedEvidence");
  const inferredRisk = parseStringArray(output.inferredRisk, "inferredRisk");
  const recommendation = parseNonEmptyString(output.recommendation, "recommendation");
  const confidence = parseConfidence(output.confidence);

  return {
    observedEvidence,
    inferredRisk,
    recommendation,
    confidence,
  };
}

/** Hashes explanation content for later report attestations. */
export function hashExplanation(explanation: ExplanationResult): string {
  return createHash("sha256").update(stableStringify(explanation)).digest("hex");
}

function withHash(
  explanation: ExplanationResult,
  source: GroundedExplanation["source"],
  promptVersion: string,
  providerError?: string,
): GroundedExplanation {
  return {
    ...explanation,
    source,
    promptVersion,
    explanationHash: hashExplanation(explanation),
    ...(providerError !== undefined ? { providerError } : {}),
  };
}

function toSanitizedSignal(signal: RiskSignal): SanitizedRiskSignal {
  return {
    id: trimText(signal.id),
    detectorId: trimText(signal.detectorId),
    category: signal.category,
    severity: signal.severity,
    confidence: signal.confidence,
    impact: signal.impact,
    observed: signal.observed.map(trimText),
    inferred: signal.inferred.map(trimText),
    evidence: signal.evidence.map((item) => ({
      label: trimText(item.label),
      value: trimText(item.value),
      source: item.source,
    })),
  };
}

function sanitizeRecord(record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, value]) => [trimText(key), sanitizeValue(value)]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return trimText(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeValue);
  if (isRecord(value)) return sanitizeRecord(value);
  return "[unsupported-value]";
}

function isSensitiveKey(key: string): boolean {
  return /private|secret|seed|mnemonic|password|token|api[_-]?key|signature/i.test(key);
}

function trimText(value: string): string {
  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

function parseStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string array.`);
  }

  return value.map((item) => parseNonEmptyString(item, field));
}

function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }
  return trimText(value.trim());
}

function parseConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError("confidence must be a number between 0 and 1.");
  }
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
