import { CasperPublicationStatus, type CasperPublisher } from "@casper-sentinel/casper";
import { describe, expect, it } from "vitest";
import { publishQueuedReports, type PublicationReportRepository, type PublishableRiskReport } from "./main.js";

const queuedReport: PublishableRiskReport = {
  id: "report-001",
  walletAddress: "account-hash-sender",
  createdAt: "2026-06-30T00:00:00.000Z",
  riskScore: 72,
  decision: "WARN",
  explanationHash: "explanation-hash",
  metadataHash: "metadata-hash",
  casperStatus: "queued",
};

describe("publishQueuedReports", () => {
  it("marks reports confirmed only when the publisher confirms them", async () => {
    const updates: unknown[] = [];
    const repository: PublicationReportRepository = {
      listQueued: () => Promise.resolve([queuedReport]),
      updateCasperPublication: (_id, update) => {
        updates.push(update);
        return Promise.resolve();
      },
    };
    const publisher: CasperPublisher = {
      publish: () => Promise.resolve({ status: CasperPublicationStatus.Confirmed, transactionHash: "deploy-hash-001" }),
    };

    await expect(
      publishQueuedReports({ repository, publisher, now: () => new Date("2026-06-30T00:01:00.000Z") }),
    ).resolves.toEqual({ attempted: 1, submitted: 0, confirmed: 1, failed: 0 });
    expect(updates).toEqual([
      { status: "confirmed", transactionHash: "deploy-hash-001", updatedAt: "2026-06-30T00:01:00.000Z" },
    ]);
  });

  it("preserves submitted status when confirmation is pending", async () => {
    const updates: unknown[] = [];
    const repository: PublicationReportRepository = {
      listQueued: () => Promise.resolve([queuedReport]),
      updateCasperPublication: (_id, update) => {
        updates.push(update);
        return Promise.resolve();
      },
    };
    const publisher: CasperPublisher = {
      publish: () => Promise.resolve({ status: CasperPublicationStatus.Submitted, transactionHash: "deploy-hash-002" }),
    };

    await expect(
      publishQueuedReports({ repository, publisher, now: () => new Date("2026-06-30T00:02:00.000Z") }),
    ).resolves.toEqual({ attempted: 1, submitted: 1, confirmed: 0, failed: 0 });
    expect(updates).toEqual([
      { status: "submitted", transactionHash: "deploy-hash-002", updatedAt: "2026-06-30T00:02:00.000Z" },
    ]);
  });

  it("records failed publications without a fake transaction hash", async () => {
    const updates: unknown[] = [];
    const repository: PublicationReportRepository = {
      listQueued: () => Promise.resolve([queuedReport]),
      updateCasperPublication: (_id, update) => {
        updates.push(update);
        return Promise.resolve();
      },
    };
    const publisher: CasperPublisher = {
      publish: () => Promise.resolve({ status: CasperPublicationStatus.Failed, errorMessage: "Signer unavailable." }),
    };

    await expect(
      publishQueuedReports({ repository, publisher, now: () => new Date("2026-06-30T00:03:00.000Z") }),
    ).resolves.toEqual({ attempted: 1, submitted: 0, confirmed: 0, failed: 1 });
    expect(updates).toEqual([
      { status: "failed", errorMessage: "Signer unavailable.", updatedAt: "2026-06-30T00:03:00.000Z" },
    ]);
  });
});

