import { describe, expect, it } from "vitest";
import {
  JsonRpcCasperDeployGateway,
  assertCasperLiveReadiness,
  buildRecordReportDeployCall,
  CasperPublicationStatus,
  CasperReportPublisher,
  assertValidAttestation,
  toRiskReportAttestation,
  type CasperDeployGateway,
  type JsonRpcFetch,
  type RiskReportAttestation,
  type SignedCasperTransactionFactory,
} from "./index.js";

const attestation: RiskReportAttestation = {
  reportId: "report-001",
  walletAddress: "account-hash-sender",
  timestamp: "2026-06-30T00:00:00.000Z",
  riskScore: 72,
  decision: "WARN",
  explanationHash: "explanation-hash",
  metadataHash: "metadata-hash",
};

const deployCall = buildRecordReportDeployCall(attestation, "hash-contract");

describe("Casper report publisher", () => {
  it("builds the record_report deploy call without submitting it", () => {
    expect(deployCall).toEqual({
      contractHash: "hash-contract",
      entryPoint: "record_report",
      args: {
        report_id: "report-001",
        wallet_address: "account-hash-sender",
        timestamp: "2026-06-30T00:00:00.000Z",
        risk_score: 72,
        decision: "WARN",
        explanation_hash: "explanation-hash",
        metadata_hash: "metadata-hash",
      },
    });
  });

  it("confirms only when the gateway returns explicit confirmation", async () => {
    const gateway: CasperDeployGateway = {
      submitRecordReport: () => Promise.resolve("deploy-hash-001"),
      waitForConfirmation: (transactionHash) => Promise.resolve({ transactionHash, confirmed: true }),
    };
    const publisher = new CasperReportPublisher({ contractHash: "hash-contract", gateway });

    await expect(publisher.publish(attestation)).resolves.toEqual({
      status: CasperPublicationStatus.Confirmed,
      transactionHash: "deploy-hash-001",
    });
  });

  it("keeps submitted status when confirmation is still pending", async () => {
    const gateway: CasperDeployGateway = {
      submitRecordReport: () => Promise.resolve("deploy-hash-002"),
      waitForConfirmation: (transactionHash) => Promise.resolve({ transactionHash, confirmed: false }),
    };
    const publisher = new CasperReportPublisher({ contractHash: "hash-contract", gateway });

    await expect(publisher.publish(attestation)).resolves.toEqual({
      status: CasperPublicationStatus.Submitted,
      transactionHash: "deploy-hash-002",
    });
  });

  it("returns failed status for invalid attestations", async () => {
    const gateway: CasperDeployGateway = {
      submitRecordReport: () => Promise.resolve("deploy-hash-003"),
      waitForConfirmation: (transactionHash) => Promise.resolve({ transactionHash, confirmed: true }),
    };
    const publisher = new CasperReportPublisher({ contractHash: "hash-contract", gateway });

    await expect(publisher.publish({ ...attestation, riskScore: 101 })).resolves.toMatchObject({
      status: CasperPublicationStatus.Failed,
    });
  });

  it("converts domain risk reports into compact attestations", () => {
    expect(
      toRiskReportAttestation({
        id: "report-001",
        walletAddress: "account-hash-sender",
        timestamp: "2026-06-30T00:00:00.000Z",
        riskScore: 72,
        decision: "WARN",
        explanationHash: "explanation-hash",
        metadataHash: "metadata-hash",
      }),
    ).toEqual(attestation);
  });

  it("rejects blank transaction hashes before gateway submission", () => {
    expect(() => assertValidAttestation({ ...attestation, transactionHash: " " })).toThrow(
      "Transaction hash must be omitted instead of blank.",
    );
  });
});

describe("JsonRpcCasperDeployGateway", () => {
  it("submits an already-signed transaction through account_put_transaction", async () => {
    const requests: JsonRpcRequest[] = [];
    const signer: SignedCasperTransactionFactory = {
      createSignedTransaction: (report, call) => {
        expect(report).toEqual(attestation);
        expect(call).toEqual(deployCall);
        return Promise.resolve({ Version1: { signed: true } });
      },
    };
    const fetch = createQueuedFetch(requests, [{ transaction_hash: "transaction-hash-001" }]);
    const gateway = new JsonRpcCasperDeployGateway({
      rpcUrl: "https://node.testnet.casper.network/rpc",
      signedTransactionFactory: signer,
      fetch,
    });

    await expect(gateway.submitRecordReport(attestation, deployCall)).resolves.toBe("transaction-hash-001");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://node.testnet.casper.network/rpc");
    expect(requests[0]?.body).toMatchObject({
      jsonrpc: "2.0",
      method: "account_put_transaction",
      params: { transaction: { Version1: { signed: true } } },
    });
  });

  it("supports legacy deploy JSON-RPC submission without rewriting publisher logic", async () => {
    const requests: JsonRpcRequest[] = [];
    const gateway = new JsonRpcCasperDeployGateway({
      rpcUrl: "https://node.testnet.casper.network/rpc",
      mode: "legacy-deploy",
      signedTransactionFactory: createSigner({ signed: true }),
      fetch: createQueuedFetch(requests, [{ deploy_hash: { hash: "legacy-deploy-hash-001" } }]),
    });

    await expect(gateway.submitRecordReport(attestation, deployCall)).resolves.toBe("legacy-deploy-hash-001");
    expect(requests[0]?.body).toMatchObject({
      method: "account_put_deploy",
      params: { deploy: { signed: true } },
    });
  });

  it("returns confirmed only after Casper status includes execution results", async () => {
    const requests: JsonRpcRequest[] = [];
    const gateway = new JsonRpcCasperDeployGateway({
      rpcUrl: "https://node.testnet.casper.network/rpc",
      signedTransactionFactory: createSigner({ signed: true }),
      fetch: createQueuedFetch(requests, [
        { transaction: { execution_info: { execution_result: { Success: { effect: {} } } } } },
      ]),
      confirmationPolls: 1,
    });

    await expect(gateway.waitForConfirmation("transaction-hash-002")).resolves.toEqual({
      transactionHash: "transaction-hash-002",
      confirmed: true,
    });
    expect(requests[0]?.body).toMatchObject({
      method: "info_get_transaction",
      params: { transaction_hash: "transaction-hash-002" },
    });
  });

  it("keeps confirmation pending when status responses do not include execution results", async () => {
    const requests: JsonRpcRequest[] = [];
    const sleeps: number[] = [];
    const gateway = new JsonRpcCasperDeployGateway({
      rpcUrl: "https://node.testnet.casper.network/rpc",
      signedTransactionFactory: createSigner({ signed: true }),
      fetch: createQueuedFetch(requests, [{ transaction: { hash: "transaction-hash-003" } }, { transaction: {} }]),
      sleep: (milliseconds) => {
        sleeps.push(milliseconds);
        return Promise.resolve();
      },
      confirmationPolls: 2,
      confirmationDelayMs: 25,
    });

    await expect(gateway.waitForConfirmation("transaction-hash-003")).resolves.toEqual({
      transactionHash: "transaction-hash-003",
      confirmed: false,
    });
    expect(requests).toHaveLength(2);
    expect(sleeps).toEqual([25]);
  });

  it("surfaces JSON-RPC errors instead of fabricating submission success", async () => {
    const gateway = new JsonRpcCasperDeployGateway({
      rpcUrl: "https://node.testnet.casper.network/rpc",
      signedTransactionFactory: createSigner({ signed: true }),
      fetch: createErrorFetch("invalid transaction"),
    });

    await expect(gateway.submitRecordReport(attestation, deployCall)).rejects.toThrow(
      "Casper RPC error: invalid transaction",
    );
  });
});

describe("Casper live readiness", () => {
  it("requires all live publication environment fields", () => {
    expect(() => assertCasperLiveReadiness({ rpcUrl: "https://node.testnet.casper.network/rpc" })).toThrow(
      "Missing: CASPER_SSE_URL, CASPER_RISK_REPORT_CONTRACT_HASH, CASPER_PUBLISHER_PUBLIC_KEY.",
    );
  });

  it("accepts a complete live publication configuration", () => {
    expect(() =>
      assertCasperLiveReadiness({
        rpcUrl: "https://node.testnet.casper.network/rpc",
        sseUrl: "https://node.testnet.casper.network/events/main",
        contractHash: "hash-contract",
        publisherPublicKey: "publisher-public-key",
      }),
    ).not.toThrow();
  });
});

interface JsonRpcRequest {
  readonly url: string;
  readonly body: Record<string, unknown>;
}

function createSigner(payload: unknown): SignedCasperTransactionFactory {
  return {
    createSignedTransaction: () => Promise.resolve(payload),
  };
}

function createQueuedFetch(requests: JsonRpcRequest[], results: unknown[]): JsonRpcFetch {
  return (url, init) => {
    const body = parseJsonRpcRequest(init.body);
    requests.push({ url, body });
    const result = results.shift();
    if (result === undefined) throw new Error("Unexpected JSON-RPC request in test.");
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ jsonrpc: "2.0", id: body.id, result }),
    });
  };
}

function createErrorFetch(message: string): JsonRpcFetch {
  return (url, init) => {
    const body = parseJsonRpcRequest(init.body);
    expect(url).toContain("casper.network");
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ jsonrpc: "2.0", id: body.id, error: { message } }),
    });
  };
}

function parseJsonRpcRequest(value: string): Record<string, unknown> & { readonly id: string } {
  const parsed: unknown = JSON.parse(value);
  if (!isJsonRpcRequest(parsed)) {
    throw new Error("Expected a JSON-RPC request body with an id.");
  }
  return parsed;
}

function isJsonRpcRequest(value: unknown): value is Record<string, unknown> & { readonly id: string } {
  return isTestRecord(value) && typeof value.id === "string";
}

function isTestRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

