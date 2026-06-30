import { describe, expect, it } from "vitest";
import { RiskSignalImpact, TransactionKind, type RiskSignal } from "@casper-sentinel/domain";
import {
  buildBlockingApprovalIntent,
  buildMvpPolicy,
  buildSafeTransferIntent,
  buildWarningContractCallIntent,
} from "@casper-sentinel/testkit";
import { aggregateSignals, analyzeAndDecide, createMvpRiskEngine, createRiskEngine, decide } from "./index.js";

const policy = buildMvpPolicy();
const context = { policy, now: new Date("2026-06-30T00:00:00Z") };

const signal: RiskSignal = {
  id: "signal.high-value",
  detectorId: "value-detector",
  category: "wallet",
  severity: 0.5,
  confidence: 0.8,
  weight: 1,
  impact: RiskSignalImpact.Warn,
  observed: ["Transfer amount exceeded local policy threshold."],
  inferred: ["Large transfers deserve additional review."],
  evidence: [{ label: "amount", value: "1000000000", source: "intent" }],
};

describe("risk engine", () => {
  it("returns a zero score when no detectors emit signals", () => {
    expect(aggregateSignals([])).toMatchObject({ value: 0, band: "LOW", confidence: 1 });
  });

  it("aggregates emitted signals", async () => {
    const engine = createRiskEngine([{ id: "fixture-detector", analyze: () => Promise.resolve([signal]) }]);
    await expect(engine.analyze(buildSafeTransferIntent(), context)).resolves.toMatchObject({
      value: 50,
      band: "MEDIUM",
      confidence: 0.8,
    });
  });

  it("runs the default MVP detector registry", async () => {
    const score = await createMvpRiskEngine().analyze(buildWarningContractCallIntent(), context);

    expect(score.signals.map((item) => item.detectorId)).toContain("target");
    expect(score.value).toBeGreaterThan(0);
  });
});

describe("decision engine", () => {
  it("approves a safe transaction intent", async () => {
    const decision = await analyzeAndDecide(buildSafeTransferIntent(), context);

    expect(decision.action).toBe("APPROVE");
    expect(decision.score.value).toBe(0);
  });

  it("warns for unknown high-value contract calls", async () => {
    const decision = await analyzeAndDecide(buildWarningContractCallIntent(), context);

    expect(decision.action).toBe("WARN");
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  it("blocks hard policy violations", async () => {
    const decision = await analyzeAndDecide(buildBlockingApprovalIntent(), context);

    expect(decision.action).toBe("BLOCK");
    expect(decision.reasons.join(" ")).toContain("denylist");
  });

  it("blocks when the score crosses the configured block threshold", () => {
    const score = aggregateSignals([
      { ...signal, id: "a", severity: 0.7, weight: 1, impact: RiskSignalImpact.ScoreOnly },
      { ...signal, id: "b", severity: 0.55, weight: 1, impact: RiskSignalImpact.ScoreOnly },
    ]);

    expect(decide(score, { ...policy, blockScore: 80 }).action).toBe("BLOCK");
  });

  it("hard-blocks malformed input before scoring ambiguity can pass", async () => {
    const decision = await analyzeAndDecide(
      buildSafeTransferIntent({
        transactionKind: TransactionKind.Transfer,
        amountMotes: "not-a-number",
      }),
      context,
    );

    expect(decision.action).toBe("BLOCK");
    expect(decision.reasons[0]).toContain("not a valid unsigned integer");
  });
});
