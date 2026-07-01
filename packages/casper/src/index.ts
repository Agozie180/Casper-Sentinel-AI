import type { DecisionAction, RiskReport } from "@casper-sentinel/domain";

export const CasperPublicationStatus = {
  NotQueued: "not_queued",
  Queued: "queued",
  Submitted: "submitted",
  Confirmed: "confirmed",
  Failed: "failed",
} as const;

export type CasperPublicationStatus = (typeof CasperPublicationStatus)[keyof typeof CasperPublicationStatus];

export interface RiskReportAttestation {
  readonly reportId: string;
  readonly walletAddress: string;
  readonly transactionHash?: string;
  readonly timestamp: string;
  readonly riskScore: number;
  readonly decision: DecisionAction;
  readonly explanationHash: string;
  readonly metadataHash: string;
}

export interface RecordReportDeployCall {
  readonly contractHash: string;
  readonly entryPoint: "record_report";
  readonly args: {
    readonly report_id: string;
    readonly wallet_address: string;
    readonly transaction_hash?: string;
    readonly timestamp: string;
    readonly risk_score: number;
    readonly decision: DecisionAction;
    readonly explanation_hash: string;
    readonly metadata_hash: string;
  };
}

export interface CasperPublishResult {
  readonly status: Exclude<CasperPublicationStatus, "not_queued" | "queued">;
  readonly transactionHash?: string;
  readonly errorMessage?: string;
}

export interface CasperDeployConfirmation {
  readonly transactionHash: string;
  readonly confirmed: boolean;
}

export interface CasperDeployGateway {
  submitRecordReport(attestation: RiskReportAttestation, deployCall: RecordReportDeployCall): Promise<string>;
  waitForConfirmation(transactionHash: string): Promise<CasperDeployConfirmation>;
}

export interface SignedCasperTransactionFactory {
  createSignedTransaction(attestation: RiskReportAttestation, deployCall: RecordReportDeployCall): Promise<unknown>;
}

export interface JsonRpcHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type JsonRpcFetch = (
  url: string,
  init: {
    readonly method: "POST";
    readonly headers: Record<string, string>;
    readonly body: string;
  },
) => Promise<JsonRpcHttpResponse>;

export type CasperRpcSubmissionMode = "transaction-v2" | "legacy-deploy";

export interface JsonRpcCasperDeployGatewayOptions {
  readonly rpcUrl: string;
  readonly signedTransactionFactory: SignedCasperTransactionFactory;
  readonly mode?: CasperRpcSubmissionMode;
  readonly fetch?: JsonRpcFetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly confirmationPolls?: number;
  readonly confirmationDelayMs?: number;
}

export interface CasperLiveReadinessConfig {
  readonly rpcUrl?: string;
  readonly sseUrl?: string;
  readonly contractHash?: string;
  readonly publisherPublicKey?: string;
}

export interface CasperReportPublisherOptions {
  readonly contractHash: string;
  readonly gateway: CasperDeployGateway;
}

export interface CasperPublisher {
  publish(report: RiskReportAttestation): Promise<CasperPublishResult>;
}

/** Publishes compact report attestations through an injected Casper deploy gateway. */
export class CasperReportPublisher implements CasperPublisher {
  constructor(private readonly options: CasperReportPublisherOptions) {}

  async publish(report: RiskReportAttestation): Promise<CasperPublishResult> {
    try {
      assertValidAttestation(report);
      const deployCall = buildRecordReportDeployCall(report, this.options.contractHash);
      const transactionHash = await this.options.gateway.submitRecordReport(report, deployCall);
      const confirmation = await this.options.gateway.waitForConfirmation(transactionHash);

      if (confirmation.confirmed) {
        return { status: CasperPublicationStatus.Confirmed, transactionHash: confirmation.transactionHash };
      }

      return { status: CasperPublicationStatus.Submitted, transactionHash };
    } catch (error: unknown) {
      return {
        status: CasperPublicationStatus.Failed,
        errorMessage: error instanceof Error ? error.message : "Casper publication failed.",
      };
    }
  }
}

/** JSON-RPC gateway for submitting already-signed Casper transactions and polling finality. */
export class JsonRpcCasperDeployGateway implements CasperDeployGateway {
  private readonly rpcUrl: string;
  private readonly mode: CasperRpcSubmissionMode;
  private readonly httpFetch: JsonRpcFetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly confirmationPolls: number;
  private readonly confirmationDelayMs: number;
  private readonly signedTransactionFactory: SignedCasperTransactionFactory;

  constructor(options: JsonRpcCasperDeployGatewayOptions) {
    if (options.rpcUrl.trim().length === 0) throw new Error("CASPER_RPC_URL is required for live submission.");
    if (options.confirmationPolls !== undefined && options.confirmationPolls < 1) {
      throw new Error("confirmationPolls must be at least 1.");
    }
    if (options.confirmationDelayMs !== undefined && options.confirmationDelayMs < 0) {
      throw new Error("confirmationDelayMs must be zero or greater.");
    }

    this.rpcUrl = options.rpcUrl;
    this.mode = options.mode ?? "transaction-v2";
    this.signedTransactionFactory = options.signedTransactionFactory;
    this.httpFetch = options.fetch ?? defaultFetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.confirmationPolls = options.confirmationPolls ?? 10;
    this.confirmationDelayMs = options.confirmationDelayMs ?? 5_000;
  }

  async submitRecordReport(attestation: RiskReportAttestation, deployCall: RecordReportDeployCall): Promise<string> {
    assertValidAttestation(attestation);
    const signedTransaction = await this.signedTransactionFactory.createSignedTransaction(attestation, deployCall);
    const result = await this.callJsonRpc(submitMethodForMode(this.mode), submitParamsForMode(this.mode, signedTransaction));
    const transactionHash = extractTransactionHash(result);

    if (transactionHash === undefined) {
      throw new Error("Casper RPC submission did not return a transaction hash.");
    }

    return transactionHash;
  }

  async waitForConfirmation(transactionHash: string): Promise<CasperDeployConfirmation> {
    if (transactionHash.trim().length === 0) throw new Error("Transaction hash is required for confirmation polling.");

    for (let attempt = 0; attempt < this.confirmationPolls; attempt += 1) {
      const result = await this.callJsonRpc(statusMethodForMode(this.mode), statusParamsForMode(this.mode, transactionHash));
      if (isConfirmedCasperStatus(result)) return { transactionHash, confirmed: true };
      if (attempt + 1 < this.confirmationPolls) await this.sleep(this.confirmationDelayMs);
    }

    return { transactionHash, confirmed: false };
  }

  private async callJsonRpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = `casper-sentinel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const response = await this.httpFetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });

    if (!response.ok) {
      throw new Error(`Casper RPC HTTP request failed with status ${response.status}.`);
    }

    return parseJsonRpcResult(await response.json(), id);
  }
}

/** Converts a report into the compact attestation shape intended for Casper Testnet storage. */
export function toRiskReportAttestation(report: RiskReport): RiskReportAttestation {
  return {
    reportId: report.id,
    walletAddress: report.walletAddress,
    ...(report.transactionHash !== undefined ? { transactionHash: report.transactionHash } : {}),
    timestamp: report.timestamp,
    riskScore: report.riskScore,
    decision: report.decision,
    explanationHash: report.explanationHash,
    metadataHash: report.metadataHash,
  };
}

/** Builds the exact contract-call payload for the `record_report` entry point. */
export function buildRecordReportDeployCall(
  report: RiskReportAttestation,
  contractHash: string,
): RecordReportDeployCall {
  if (contractHash.trim().length === 0) {
    throw new Error("CASPER_RISK_REPORT_CONTRACT_HASH is required before publishing reports.");
  }
  assertValidAttestation(report);

  return {
    contractHash,
    entryPoint: "record_report",
    args: {
      report_id: report.reportId,
      wallet_address: report.walletAddress,
      ...(report.transactionHash !== undefined ? { transaction_hash: report.transactionHash } : {}),
      timestamp: report.timestamp,
      risk_score: report.riskScore,
      decision: report.decision,
      explanation_hash: report.explanationHash,
      metadata_hash: report.metadataHash,
    },
  };
}

/** Validates the environment fields required before attempting a live Casper Testnet submission. */
export function assertCasperLiveReadiness(config: CasperLiveReadinessConfig): void {
  const missing: string[] = [];
  if (config.rpcUrl === undefined || config.rpcUrl.trim().length === 0) missing.push("CASPER_RPC_URL");
  if (config.sseUrl === undefined || config.sseUrl.trim().length === 0) missing.push("CASPER_SSE_URL");
  if (config.contractHash === undefined || config.contractHash.trim().length === 0) {
    missing.push("CASPER_RISK_REPORT_CONTRACT_HASH");
  }
  if (config.publisherPublicKey === undefined || config.publisherPublicKey.trim().length === 0) {
    missing.push("CASPER_PUBLISHER_PUBLIC_KEY");
  }
  if (missing.length > 0) throw new Error(`Live Casper publication is not ready. Missing: ${missing.join(", ")}.`);
}

/** Validates a compact report attestation before it can be handed to a Casper gateway. */
export function assertValidAttestation(report: RiskReportAttestation): void {
  if (report.reportId.trim().length === 0) throw new Error("Report id is required for Casper publication.");
  if (report.walletAddress.trim().length === 0) throw new Error("Wallet address is required for Casper publication.");
  if (report.transactionHash !== undefined && report.transactionHash.trim().length === 0) {
    throw new Error("Transaction hash must be omitted instead of blank.");
  }
  if (!Number.isInteger(report.riskScore) || report.riskScore < 0 || report.riskScore > 100) {
    throw new Error("Risk score must be an integer between 0 and 100.");
  }
  if (Number.isNaN(Date.parse(report.timestamp))) throw new Error("Timestamp must be an ISO date string.");
  if (report.explanationHash.trim().length === 0) throw new Error("Explanation hash is required.");
  if (report.metadataHash.trim().length === 0) throw new Error("Metadata hash is required.");
}

function submitMethodForMode(mode: CasperRpcSubmissionMode): string {
  return mode === "transaction-v2" ? "account_put_transaction" : "account_put_deploy";
}

function statusMethodForMode(mode: CasperRpcSubmissionMode): string {
  return mode === "transaction-v2" ? "info_get_transaction" : "info_get_deploy";
}

function submitParamsForMode(mode: CasperRpcSubmissionMode, signedTransaction: unknown): Record<string, unknown> {
  return mode === "transaction-v2" ? { transaction: signedTransaction } : { deploy: signedTransaction };
}

function statusParamsForMode(mode: CasperRpcSubmissionMode, transactionHash: string): Record<string, unknown> {
  return mode === "transaction-v2" ? { transaction_hash: transactionHash } : { deploy_hash: transactionHash };
}

function parseJsonRpcResult(response: unknown, expectedId: string): unknown {
  if (!isRecord(response)) throw new Error("Casper RPC returned an invalid JSON-RPC response.");
  if (response.id !== expectedId) throw new Error("Casper RPC returned a mismatched JSON-RPC id.");

  if ("error" in response) {
    const error = response.error;
    const message = isRecord(error) && typeof error.message === "string" ? error.message : "Unknown Casper RPC error.";
    throw new Error(`Casper RPC error: ${message}`);
  }

  if (!("result" in response)) throw new Error("Casper RPC response did not include a result.");
  return response.result;
}

function extractTransactionHash(result: unknown): string | undefined {
  if (!isRecord(result)) return undefined;
  const directHash = readStringProperty(result, "transaction_hash") ?? readStringProperty(result, "deploy_hash");
  if (directHash !== undefined) return directHash;

  const transactionHash = result.transaction_hash;
  if (isRecord(transactionHash)) return readStringProperty(transactionHash, "hash");

  const deployHash = result.deploy_hash;
  if (isRecord(deployHash)) return readStringProperty(deployHash, "hash");

  return undefined;
}

function isConfirmedCasperStatus(result: unknown): boolean {
  if (!isRecord(result)) return false;
  if (hasNonEmptyArray(result, "execution_results")) return true;
  if (hasNonEmptyArray(result, "ExecutionResults")) return true;

  const transaction = result.transaction;
  if (isRecord(transaction) && hasExecutionResult(transaction)) return true;

  const deploy = result.deploy;
  if (isRecord(deploy) && hasExecutionResult(deploy)) return true;

  return hasExecutionResult(result);
}

function hasExecutionResult(value: Record<string, unknown>): boolean {
  const executionInfo = value.execution_info;
  if (isRecord(executionInfo) && isRecord(executionInfo.execution_result)) return true;

  const executionResult = value.execution_result;
  if (isRecord(executionResult)) return true;

  return false;
}

function hasNonEmptyArray(value: Record<string, unknown>, key: string): boolean {
  const property = value[key];
  return Array.isArray(property) && property.length > 0;
}

function readStringProperty(value: Record<string, unknown>, key: string): string | undefined {
  const property = value[key];
  return typeof property === "string" && property.trim().length > 0 ? property : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultFetch(url: string, init: Parameters<JsonRpcFetch>[1]): Promise<JsonRpcHttpResponse> {
  return fetch(url, init);
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
