import { describe, expect, it } from "vitest";
import {
  buildRecordReportDeployCall,
  CasperPublicationStatus,
  CasperReportPublisher,
  assertValidAttestation,
  toRiskReportAttestation,
  type CasperDeployGateway,
  type RiskReportAttestation,
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

describe("Casper report publisher", () => {
  it("builds the record_report deploy call without submitting it", () => {
    expect(buildRecordReportDeployCall(attestation, "hash-contract")).toEqual({
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

