import { describe, expect, it } from "vitest";
import { TransactionKind } from "@casper-sentinel/domain";
import {
  blockedContract,
  blockedWallet,
  buildMvpPolicy,
  buildSafeTransferIntent,
  buildWarningContractCallIntent,
  trustedContract,
  unknownContract,
} from "@casper-sentinel/testkit";
import { approvalScopeDetector } from "./approval-scope-detector.js";
import { malformedArgsDetector } from "./malformed-args-detector.js";
import { metadataDetector } from "./metadata-detector.js";
import { policyListDetector } from "./policy-list-detector.js";
import { targetDetector } from "./target-detector.js";
import { valueDetector } from "./value-detector.js";

const context = { policy: buildMvpPolicy(), now: new Date("2026-06-30T00:00:00Z") };

describe("malformedArgsDetector", () => {
  it("hard-blocks malformed amount values", async () => {
    const signals = await malformedArgsDetector.analyze(
      buildSafeTransferIntent({ amountMotes: "1.5" }),
      context,
    );

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ id: "input.amount.invalid", impact: "HARD_BLOCK" });
  });
});

describe("policyListDetector", () => {
  it("hard-blocks denylisted wallets and targets", async () => {
    const signals = await policyListDetector.analyze(
      buildSafeTransferIntent({ walletAddress: blockedWallet, target: blockedContract }),
      context,
    );

    expect(signals.map((signal) => signal.id)).toEqual([
      "policy.wallet.denylisted",
      "policy.target.denylisted",
    ]);
    expect(signals.every((signal) => signal.impact === "HARD_BLOCK")).toBe(true);
  });
});

describe("valueDetector", () => {
  it("warns on high-value transfers", async () => {
    const signals = await valueDetector.analyze(
      buildSafeTransferIntent({ amountMotes: "150000000000" }),
      context,
    );

    expect(signals[0]).toMatchObject({ id: "value.warning-threshold", impact: "WARN" });
  });

  it("hard-blocks transfers above the block threshold", async () => {
    const signals = await valueDetector.analyze(
      buildSafeTransferIntent({ amountMotes: "1000000000000" }),
      context,
    );

    expect(signals[0]).toMatchObject({ id: "value.block-threshold", impact: "HARD_BLOCK" });
  });
});

describe("targetDetector", () => {
  it("warns when the target is unknown", async () => {
    const signals = await targetDetector.analyze(buildWarningContractCallIntent(), context);

    expect(signals[0]).toMatchObject({ id: "target.unknown", impact: "WARN" });
  });

  it("does not warn on allowlisted targets", async () => {
    const signals = await targetDetector.analyze(
      buildSafeTransferIntent({ target: trustedContract }),
      context,
    );

    expect(signals).toEqual([]);
  });
});

describe("approvalScopeDetector", () => {
  it("hard-blocks missing approval scope", async () => {
    const signals = await approvalScopeDetector.analyze(
      buildSafeTransferIntent({ transactionKind: TransactionKind.Approval }),
      context,
    );

    expect(signals[0]).toMatchObject({ id: "approval.scope.missing", impact: "HARD_BLOCK" });
  });

  it("hard-blocks unlimited approvals", async () => {
    const signals = await approvalScopeDetector.analyze(
      buildSafeTransferIntent({
        transactionKind: TransactionKind.Approval,
        approvalScope: { spender: unknownContract, unlimited: true },
      }),
      context,
    );

    expect(signals[0]).toMatchObject({ id: "approval.scope.unlimited", impact: "HARD_BLOCK" });
  });

  it("warns on excessive bounded approvals", async () => {
    const signals = await approvalScopeDetector.analyze(
      buildSafeTransferIntent({
        transactionKind: TransactionKind.Approval,
        approvalScope: { spender: unknownContract, allowanceMotes: "600000000000" },
      }),
      context,
    );

    expect(signals[0]).toMatchObject({ id: "approval.scope.excessive", impact: "WARN" });
  });
});

describe("metadataDetector", () => {
  it("warns when contract metadata is missing", async () => {
    const signals = await metadataDetector.analyze(buildWarningContractCallIntent(), context);

    expect(signals[0]).toMatchObject({ id: "metadata.missing", impact: "WARN" });
  });

  it("warns when the entry point is not allowed", async () => {
    const signals = await metadataDetector.analyze(
      buildWarningContractCallIntent({ target: trustedContract, entryPoint: "withdraw_all" }),
      context,
    );

    expect(signals[0]).toMatchObject({ id: "metadata.entry-point.unexpected", impact: "WARN" });
  });
});

