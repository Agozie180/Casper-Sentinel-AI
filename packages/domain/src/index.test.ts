import { describe, expect, it } from "vitest";
import {
  DecisionAction,
  assertRiskScoreValue,
  createSecurityPolicy,
  isDecisionAction,
  riskBandForScore,
} from "./index.js";

describe("domain risk primitives", () => {
  it("recognizes supported decision actions", () => {
    expect(isDecisionAction(DecisionAction.Approve)).toBe(true);
    expect(isDecisionAction("ALLOW")).toBe(false);
  });

  it("rejects scores outside the shared range", () => {
    expect(() => assertRiskScoreValue(101)).toThrow(RangeError);
    expect(() => assertRiskScoreValue(50)).not.toThrow();
  });

  it("maps risk scores to stable bands", () => {
    expect(riskBandForScore(10)).toBe("LOW");
    expect(riskBandForScore(40)).toBe("MEDIUM");
    expect(riskBandForScore(70)).toBe("HIGH");
    expect(riskBandForScore(90)).toBe("CRITICAL");
  });

  it("creates a policy value with explicit overrides", () => {
    const policy = createSecurityPolicy({
      version: "test-policy",
      denylistedTargets: ["hash-deny"],
    });

    expect(policy.version).toBe("test-policy");
    expect(policy.denylistedTargets).toEqual(["hash-deny"]);
    expect(policy.warnScore).toBe(40);
  });
});
