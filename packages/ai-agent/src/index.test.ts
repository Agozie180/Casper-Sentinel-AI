import { describe, expect, it } from "vitest";
import { decide } from "@casper-sentinel/risk-engine";
import { buildBlockingApprovalIntent, buildMvpPolicy } from "@casper-sentinel/testkit";
import { createMvpRiskEngine } from "@casper-sentinel/risk-engine";
import {
  buildAnalystPrompt,
  createAIAnalyst,
  hashExplanation,
  parseExplanationResult,
  sanitizeExplanationRequest,
  type ExplanationRequest,
} from "./index.js";

async function buildExplanationRequest(): Promise<ExplanationRequest> {
  const intent = buildBlockingApprovalIntent({
    args: {
      amount: "unlimited",
      privateKey: "must-not-leak",
      nested: { seedPhrase: "also-secret", safe: "visible" },
    },
    clientContext: {
      userAgent: "test-client",
      apiToken: "hidden-token",
    },
  });
  const policy = buildMvpPolicy();
  const score = await createMvpRiskEngine().analyze(intent, {
    policy,
    now: new Date("2026-06-30T00:00:00Z"),
  });
  return { intent, score, decision: decide(score, policy) };
}

describe("AI analyst", () => {
  it("sanitizes sensitive values before prompt assembly", async () => {
    const request = await buildExplanationRequest();
    const sanitized = sanitizeExplanationRequest(request);

    expect(JSON.stringify(sanitized)).not.toContain("must-not-leak");
    expect(JSON.stringify(sanitized)).not.toContain("also-secret");
    expect(JSON.stringify(sanitized)).not.toContain("hidden-token");
    expect(sanitized.intent.args).toMatchObject({ nested: { safe: "visible" } });
  });

  it("assembles a prompt that forbids hallucinated chain facts", async () => {
    const prompt = buildAnalystPrompt(sanitizeExplanationRequest(await buildExplanationRequest()));

    expect(prompt.system).toContain("Never invent wallet balances");
    expect(prompt.system).toContain("Do not change the supplied approve, warn, or block decision");
    expect(prompt.responseContract).toHaveProperty("observedEvidence");
  });

  it("validates provider output", () => {
    const explanation = parseExplanationResult({
      observedEvidence: ["Observed denylisted target."],
      inferredRisk: ["This may indicate a malicious approval."],
      recommendation: "Block the transaction.",
      confidence: 0.91,
    });

    expect(explanation.confidence).toBe(0.91);
    expect(() => parseExplanationResult({ confidence: 2 })).toThrow(TypeError);
  });

  it("uses provider output when it satisfies the schema", async () => {
    const analyst = createAIAnalyst({
      provider: {
        explain: () =>
          Promise.resolve({
            observedEvidence: ["The target appears on the denylist."],
            inferredRisk: ["The approval may expose assets to a blocked spender."],
            recommendation: "Block this approval before signing.",
            confidence: 0.95,
          }),
      },
    });

    const explanation = await analyst.explain(await buildExplanationRequest());

    expect(explanation.source).toBe("provider");
    expect(explanation.explanationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("falls back when the provider throws or returns invalid output", async () => {
    const analyst = createAIAnalyst({
      provider: {
        explain: () => Promise.resolve({ observedEvidence: [], confidence: 4 }),
      },
    });

    const explanation = await analyst.explain(await buildExplanationRequest());

    expect(explanation.source).toBe("fallback");
    expect(explanation.providerError).toContain("observedEvidence");
  });

  it("hashes equivalent explanation content consistently", () => {
    const explanation = {
      observedEvidence: ["A"],
      inferredRisk: ["B"],
      recommendation: "C",
      confidence: 0.5,
    };

    expect(hashExplanation(explanation)).toBe(hashExplanation({ ...explanation }));
  });
});
