import {
  createAIAnalyst,
  type AIAnalyst,
  type AIAnalystProvider,
  type GroundedExplanation,
} from "@casper-sentinel/ai-agent";
import {
  createSecurityPolicy,
  type ApprovalScope,
  type ContractMetadata,
  type DecisionAction,
  type RiskScore,
  type RiskSignal,
  type SecurityPolicy,
  type TransactionIntent,
} from "@casper-sentinel/domain";
import { analyzeAndDecide } from "@casper-sentinel/risk-engine";
import type { AnalyzeRequestBody } from "./schemas.js";

export interface AnalyzeTransactionOptions {
  readonly now?: () => Date;
  readonly aiAnalyst?: AIAnalyst;
  readonly aiProvider?: AIAnalystProvider;
}

export interface AnalyzeTransactionResponse {
  readonly traceId: string;
  readonly decision: DecisionAction;
  readonly riskScore: RiskScore;
  readonly signals: readonly RiskSignal[];
  readonly reasons: readonly string[];
  readonly requiredUserMessage: string;
  readonly policyVersion: string;
  readonly explanation: GroundedExplanation;
  readonly explanationHash: string;
  readonly casperPublication: {
    readonly status: "not_queued";
    readonly reason: string;
  };
}

/** Runs deterministic transaction analysis and returns the API response contract. */
export async function analyzeTransaction(
  request: AnalyzeRequestBody,
  traceId: string,
  options: AnalyzeTransactionOptions = {},
): Promise<AnalyzeTransactionResponse> {
  const intent = toTransactionIntent(request.intent);
  const policy = createSecurityPolicy(toPolicyOverrides(request.policy));
  const decision = await analyzeAndDecide(intent, {
    policy,
    now: options.now?.() ?? new Date(),
  });
  const analyst = options.aiAnalyst ?? createAIAnalyst(options.aiProvider !== undefined ? { provider: options.aiProvider } : {});
  const explanation = await analyst.explain({
    intent,
    score: decision.score,
    decision,
  });

  return {
    traceId,
    decision: decision.action,
    riskScore: decision.score,
    signals: decision.score.signals,
    reasons: decision.reasons,
    requiredUserMessage: decision.requiredUserMessage,
    policyVersion: decision.policyVersion,
    explanation,
    explanationHash: explanation.explanationHash,
    casperPublication: {
      status: "not_queued",
      reason: "Casper publication is introduced after persistence and worker phases and is not simulated.",
    },
  };
}

/** Converts parsed API input into the exact optional shape expected by the domain package. */
export function toTransactionIntent(input: AnalyzeRequestBody["intent"]): TransactionIntent {
  return {
    walletAddress: input.walletAddress,
    chainName: input.chainName,
    transactionKind: input.transactionKind,
    target: input.target,
    ...(input.entryPoint !== undefined ? { entryPoint: input.entryPoint } : {}),
    ...(input.amountMotes !== undefined ? { amountMotes: input.amountMotes } : {}),
    ...(input.approvalScope !== undefined ? { approvalScope: toApprovalScope(input.approvalScope) } : {}),
    args: input.args,
    ...(input.rawTransaction !== undefined ? { rawTransaction: input.rawTransaction } : {}),
    clientContext: input.clientContext,
  };
}

/** Converts parsed approval input into the domain approval scope shape. */
export function toApprovalScope(input: NonNullable<AnalyzeRequestBody["intent"]["approvalScope"]>): ApprovalScope {
  return {
    spender: input.spender,
    ...(input.allowanceMotes !== undefined ? { allowanceMotes: input.allowanceMotes } : {}),
    ...(input.unlimited !== undefined ? { unlimited: input.unlimited } : {}),
  };
}

/** Removes undefined optional policy fields before merging with the default MVP policy. */
export function toPolicyOverrides(
  input: AnalyzeRequestBody["policy"],
): Partial<SecurityPolicy> | undefined {
  if (input === undefined) return undefined;

  return {
    ...(input.version !== undefined ? { version: input.version } : {}),
    ...(input.warnScore !== undefined ? { warnScore: input.warnScore } : {}),
    ...(input.blockScore !== undefined ? { blockScore: input.blockScore } : {}),
    ...(input.highValueMotes !== undefined ? { highValueMotes: input.highValueMotes } : {}),
    ...(input.blockValueMotes !== undefined ? { blockValueMotes: input.blockValueMotes } : {}),
    ...(input.maxApprovalMotes !== undefined ? { maxApprovalMotes: input.maxApprovalMotes } : {}),
    ...(input.allowlistedTargets !== undefined
      ? { allowlistedTargets: input.allowlistedTargets }
      : {}),
    ...(input.denylistedTargets !== undefined ? { denylistedTargets: input.denylistedTargets } : {}),
    ...(input.denylistedWallets !== undefined ? { denylistedWallets: input.denylistedWallets } : {}),
    ...(input.knownContracts !== undefined ? { knownContracts: toKnownContracts(input.knownContracts) } : {}),
  };
}

/** Converts parsed contract metadata into the domain metadata map shape. */
export function toKnownContracts(
  input: NonNullable<AnalyzeRequestBody["policy"]>["knownContracts"],
): Readonly<Record<string, ContractMetadata>> {
  if (input === undefined) return {};

  return Object.fromEntries(
    Object.entries(input).map(([key, metadata]) => [
      key,
      {
        verified: metadata.verified,
        ...(metadata.name !== undefined ? { name: metadata.name } : {}),
        ...(metadata.allowedEntryPoints !== undefined
          ? { allowedEntryPoints: metadata.allowedEntryPoints }
          : {}),
      },
    ]),
  );
}

