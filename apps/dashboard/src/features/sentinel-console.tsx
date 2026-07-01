"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type DecisionAction = "APPROVE" | "WARN" | "BLOCK";
type TransactionKind = "TRANSFER" | "CONTRACT_CALL" | "APPROVAL" | "UNKNOWN";
type CasperStatus = string;

type ReportSummary = {
  readonly id: string;
  readonly walletAddress: string;
  readonly target: string;
  readonly transactionKind: TransactionKind;
  readonly riskScore: number;
  readonly riskBand: string;
  readonly decision: DecisionAction;
  readonly policyVersion: string;
  readonly casperStatus: CasperStatus;
  readonly casperTransactionHash?: string;
  readonly createdAt: string;
};

type RiskSignal = {
  readonly id: string;
  readonly detectorId: string;
  readonly category: string;
  readonly severity: number;
  readonly confidence: number;
  readonly impact: string;
  readonly observed: readonly string[];
  readonly inferred: readonly string[];
};

type Explanation = {
  readonly observedEvidence: readonly string[];
  readonly inferredRisk: readonly string[];
  readonly recommendation: string;
  readonly confidence: number;
  readonly source: "provider" | "fallback";
  readonly promptVersion: string;
  readonly explanationHash: string;
};

type AnalyzeResponse = {
  readonly reportId: string;
  readonly traceId: string;
  readonly decision: DecisionAction;
  readonly riskScore: { readonly value: number; readonly band: string; readonly confidence: number };
  readonly signals: readonly RiskSignal[];
  readonly reasons: readonly string[];
  readonly requiredUserMessage: string;
  readonly policyVersion: string;
  readonly explanation: Explanation;
  readonly explanationHash: string;
  readonly createdAt: string;
  readonly casperPublication: { readonly status: CasperStatus; readonly reason: string };
};

type StoredReport = ReportSummary & {
  readonly traceId: string;
  readonly explanation: Explanation;
  readonly explanationHash: string;
  readonly metadataHash: string;
  readonly intentHash: string;
  readonly casperErrorMessage?: string;
  readonly casperPublicationIdempotencyKey?: string;
  readonly confidence: number;
  readonly signals: readonly RiskSignal[];
  readonly reasons: readonly string[];
  readonly requiredUserMessage: string;
};

type PolicySettings = {
  readonly version: string;
  readonly warnScore: string;
  readonly blockScore: string;
  readonly highValueMotes: string;
  readonly blockValueMotes: string;
  readonly maxApprovalMotes: string;
  readonly allowlistedTargets: string;
  readonly denylistedTargets: string;
  readonly denylistedWallets: string;
};

type AnalyzeMode = "safe" | "warning" | "block";
type ApiState = "checking" | "online" | "offline";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const navigationItems = ["Analyze", "Policy", "Reports", "Detail"] as const;

const defaultPolicy: PolicySettings = {
  version: "judge-demo-policy-v1",
  warnScore: "40",
  blockScore: "80",
  highValueMotes: "100000000000",
  blockValueMotes: "1000000000000",
  maxApprovalMotes: "500000000000",
  allowlistedTargets: "hash-trusted-contract",
  denylistedTargets: "hash-blocked-contract",
  denylistedWallets: "",
};

const judgeDemoAnalysis: AnalyzeResponse = {
  reportId: "local-demo-report",
  traceId: "trace-local-demo",
  decision: "BLOCK",
  riskScore: { value: 94, band: "CRITICAL", confidence: 0.94 },
  signals: [
    {
      id: "demo-policy-denylist",
      detectorId: "policy-list-detector",
      category: "POLICY",
      severity: 96,
      confidence: 1,
      impact: "BLOCK",
      observed: ["Target contract appears in the active denylist."],
      inferred: ["The transaction violates the active enterprise policy."],
    },
    {
      id: "demo-approval-scope",
      detectorId: "approval-scope-detector",
      category: "APPROVAL",
      severity: 91,
      confidence: 0.92,
      impact: "BLOCK",
      observed: ["Approval request is unlimited for the selected spender."],
      inferred: ["Unlimited approvals can allow later asset movement without another user prompt."],
    },
    {
      id: "demo-metadata",
      detectorId: "metadata-detector",
      category: "CONTRACT",
      severity: 67,
      confidence: 0.78,
      impact: "WARN",
      observed: ["Contract metadata is missing from the local verified registry."],
      inferred: ["Unknown provenance increases review burden before signature."],
    },
  ],
  reasons: ["Policy denylist matched", "Unlimited approval requested", "Contract metadata unavailable"],
  requiredUserMessage: "Blocked before signature. Do not approve this transaction unless the policy owner explicitly clears the target.",
  policyVersion: "judge-demo-policy-v1",
  explanation: {
    observedEvidence: [
      "The target contract is policy-denylisted.",
      "The transaction requests an unlimited approval scope.",
      "The contract is not present in the verified metadata registry.",
    ],
    inferredRisk: [
      "A malicious or compromised spender could move assets later without another approval prompt.",
      "The missing metadata makes the contract harder to verify during a high-risk flow.",
    ],
    recommendation: "Block the transaction and require a policy-owner review before any signature is requested.",
    confidence: 0.94,
    source: "fallback",
    promptVersion: "local-demo",
    explanationHash: "hash-demo-explanation",
  },
  explanationHash: "hash-demo-explanation",
  createdAt: "2026-07-01T00:00:00.000Z",
  casperPublication: {
    status: "not_queued",
    reason: "Local judge demo only. No Casper transaction hash is claimed.",
  },
};

export function SentinelConsole() {
  const [walletAddress, setWalletAddress] = useState("account-hash-sender");
  const [connectedWallet, setConnectedWallet] = useState<string | undefined>();
  const [target, setTarget] = useState("hash-trusted-contract");
  const [amountMotes, setAmountMotes] = useState("2500000000");
  const [entryPoint, setEntryPoint] = useState("transfer");
  const [mode, setMode] = useState<AnalyzeMode>("safe");
  const [policy, setPolicy] = useState<PolicySettings>(defaultPolicy);
  const [reports, setReports] = useState<readonly ReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<StoredReport | undefined>();
  const [analysis, setAnalysis] = useState<AnalyzeResponse | undefined>();
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const activeWallet = connectedWallet ?? walletAddress;
  const activeAnalysis = analysis ?? judgeDemoAnalysis;
  const scoreTone = toneForDecision(activeAnalysis.decision);
  const displayedReports = reports.length > 0 ? reports : [toReportSummary(judgeDemoAnalysis)];
  const highestRisk = displayedReports.reduce((max, report) => Math.max(max, report.riskScore), 0);
  const queuedCount = displayedReports.filter((report) => report.casperStatus === "queued").length;
  const confirmedCount = displayedReports.filter((report) => report.casperStatus === "confirmed").length;

  useEffect(() => {
    void refreshReports();
  }, []);

  const intentPreview = useMemo(
    () => buildIntent(mode, activeWallet, target, amountMotes, entryPoint),
    [activeWallet, amountMotes, entryPoint, mode, target],
  );

  async function refreshReports() {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/reports`, { cache: "no-store" });
      if (!response.ok) throw new Error("Report history is unavailable.");
      const body = (await response.json()) as { reports: readonly ReportSummary[] };
      setReports(body.reports);
      setApiState("online");
      setError(undefined);
    } catch (caught) {
      setApiState("offline");
      setError(caught instanceof Error ? `${caught.message} Showing local judge demo.` : "Showing local judge demo.");
    }
  }

  async function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);
    setStatus("Analyzing");

    try {
      const response = await fetch(`${apiBaseUrl}/v1/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intentPreview, policy: buildPolicyPayload(policy) }),
      });
      const body = (await response.json()) as AnalyzeResponse | { error?: { message?: string } };
      if (!response.ok || isErrorResponse(body)) {
        throw new Error(isErrorResponse(body) ? body.error?.message ?? "Analysis failed." : "Analysis failed.");
      }

      setAnalysis(body);
      setStatus(body.decision);
      setApiState("online");
      await refreshReports();
      await loadReport(body.reportId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Analysis failed.";
      setError(`${message} Loaded local judge demo without claiming a chain transaction.`);
      setAnalysis(judgeDemoAnalysis);
      setSelectedReport(toStoredReport(judgeDemoAnalysis));
      setStatus("Local demo");
      setApiState("offline");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadReport(id: string) {
    if (id === judgeDemoAnalysis.reportId) {
      setSelectedReport(toStoredReport(judgeDemoAnalysis));
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/v1/reports/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Report detail is unavailable.");
      const body = (await response.json()) as { report: StoredReport };
      setSelectedReport(body.report);
      setApiState("online");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report detail is unavailable.");
      setApiState("offline");
    }
  }

  async function retryPublication(id: string) {
    if (id === judgeDemoAnalysis.reportId) {
      setError("Local judge demo cannot publish to Casper. Use a real saved report with a configured signer.");
      return;
    }

    setIsPublishing(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/v1/casper/reports/${id}/publish`, {
        method: "POST",
        headers: { "Idempotency-Key": `dashboard:${id}` },
      });
      const body = (await response.json()) as { report?: StoredReport; error?: { message?: string } };
      if (!response.ok || body.report === undefined) {
        throw new Error(body.error?.message ?? "Casper publication queue is unavailable.");
      }

      setSelectedReport(body.report);
      await refreshReports();
      setStatus("Publication queued");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Casper publication queue is unavailable.");
    } finally {
      setIsPublishing(false);
    }
  }

  function connectWallet() {
    const trimmedWallet = walletAddress.trim();
    setConnectedWallet(trimmedWallet);
    setStatus(trimmedWallet.length > 0 ? "Wallet connected" : "Wallet missing");
  }

  function applyMode(nextMode: AnalyzeMode) {
    setMode(nextMode);
    if (nextMode === "safe") {
      setTarget("hash-trusted-contract");
      setAmountMotes("2500000000");
      setEntryPoint("transfer");
    }
    if (nextMode === "warning") {
      setTarget("hash-unknown-contract");
      setAmountMotes("150000000000");
      setEntryPoint("execute");
    }
    if (nextMode === "block") {
      setTarget("hash-blocked-contract");
      setAmountMotes("2500000000");
      setEntryPoint("approve");
    }
  }

  function loadJudgeDemo() {
    setAnalysis(judgeDemoAnalysis);
    setSelectedReport(toStoredReport(judgeDemoAnalysis));
    setStatus("Local demo");
    setError("Loaded local judge demo. No Casper transaction hash is claimed.");
    applyMode("block");
  }

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brandMark" aria-hidden="true"><span /></div>
          <div>
            <strong>Casper Sentinel AI</strong>
            <span>Agent transaction security</span>
          </div>
        </div>
        <nav className="sideNav">
          {navigationItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}>
              {item}
            </a>
          ))}
        </nav>
        <div className="sideModule">
          <span>Evidence readiness</span>
          <strong>{confirmedCount > 0 ? "Evidence live" : "Awaiting signer"}</strong>
          <p>Confirmed evidence appears only after Casper RPC returns a real transaction hash.</p>
        </div>
      </aside>

      <section className="workspace" aria-label="Security workspace">
        <header className="heroBar">
          <div className="heroCopy">
            <p className="eyebrow">Security operations console</p>
            <h1>Casper Sentinel AI</h1>
            <p>
              Review unsigned Casper intent, enforce deterministic policy, and prepare evidence packets before an agent or user can sign.
            </p>
          </div>
          <div className="heroActions">
            <span className={`statusPill ${apiState}`}>API {apiState}</span>
            <span className={`statusPill ${scoreTone}`}>{status}</span>
            <button type="button" onClick={connectWallet}>Connect wallet</button>
          </div>
        </header>

        {error !== undefined ? <div className="alert">{error}</div> : null}

        <section className="metricStrip" aria-label="Security operations snapshot">
          <Metric label="Peak risk" value={highestRisk.toString()} accent="danger" />
          <Metric label="Reviewed" value={displayedReports.length.toString()} accent="info" />
          <Metric label="Queued" value={queuedCount.toString()} accent="warning" />
          <Metric label="Confirmed" value={confirmedCount.toString()} accent="secure" />
        </section>

        <div className="analysisGrid">
          <section className="panel intentPanel" id="analyze">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">Unsigned intent</p>
                <h2>Screen the request</h2>
              </div>
              <span>{shorten(activeWallet)}</span>
            </div>
            <form className="analysisForm" onSubmit={(event) => { void submitAnalysis(event); }}>
              <div className="fieldPair">
                <label>
                  Wallet
                  <input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} />
                </label>
                <label>
                  Entry point
                  <input value={entryPoint} onChange={(event) => setEntryPoint(event.target.value)} />
                </label>
              </div>
              <label>
                Target contract / account
                <input value={target} onChange={(event) => setTarget(event.target.value)} />
              </label>
              <label>
                Amount in motes
                <input value={amountMotes} onChange={(event) => setAmountMotes(event.target.value)} />
              </label>
              <div className="scenarioRail" role="group" aria-label="Scenario">
                {(["safe", "warning", "block"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={mode === item ? "active" : ""}
                    onClick={() => applyMode(item)}
                  >
                    <span>{item}</span>
                    <small>{labelForMode(item)}</small>
                  </button>
                ))}
              </div>
              <div className="actionRow">
                <button type="submit" disabled={isLoading}>{isLoading ? "Analyzing" : "Analyze intent"}</button>
                <button type="button" className="secondaryButton" onClick={loadJudgeDemo}>Load demo case</button>
              </div>
            </form>
          </section>

          <section className={`panel decisionPanel ${scoreTone}`} aria-label="Decision state">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">Policy decision</p>
                <h2>{activeAnalysis.riskScore.band}</h2>
              </div>
              <span>{activeAnalysis.explanation.confidence.toFixed(2)} confidence</span>
            </div>
            <div className="decisionBadge">
              <div className="riskDial" aria-label={`Risk score ${activeAnalysis.riskScore.value}`}>
                <span>{activeAnalysis.riskScore.value}</span>
              </div>
              <div>
                <span>{activeAnalysis.decision}</span>
                <strong>{activeAnalysis.riskScore.band}</strong>
              </div>
            </div>
            <p className="decisionMessage">{activeAnalysis.requiredUserMessage}</p>
            <div className="timeline" aria-label="Security pipeline">
              {pipelineSteps(activeAnalysis).map((step) => (
                <div key={step.label} className={step.state}>
                  <span />
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel explanationPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionKicker">AI explanation</p>
              <h2>Evidence and inference stay separate</h2>
            </div>
            <span>{activeAnalysis.explanation.source}</span>
          </div>
          <div className="explanationGrid">
            <EvidenceList title="Observed evidence" items={activeAnalysis.explanation.observedEvidence} />
            <EvidenceList title="Inferred risk" items={activeAnalysis.explanation.inferredRisk} />
          </div>
          <p className="recommendation">{activeAnalysis.explanation.recommendation}</p>
        </section>

        <section className="panel signalPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionKicker">Detector output</p>
              <h2>Signals behind the decision</h2>
            </div>
            <span>{activeAnalysis.signals.length} signals</span>
          </div>
          <div className="signalGrid">
            {activeAnalysis.signals.map((signal) => (
              <article key={signal.id} className={`signalItem ${signal.impact.toLowerCase()}`}>
                <div>
                  <strong>{signal.detectorId}</strong>
                  <span>{signal.category}</span>
                </div>
                <b>{signal.severity}</b>
                <p>{signal.observed[0] ?? signal.inferred[0] ?? "Structured risk signal."}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" id="policy">
          <div className="panelHeader">
            <div>
              <p className="sectionKicker">Policy controls</p>
              <h2>Thresholds and lists</h2>
            </div>
            <span>{policy.version}</span>
          </div>
          <div className="policyGrid">
            <label>
              Version
              <input value={policy.version} onChange={(event) => setPolicy({ ...policy, version: event.target.value })} />
            </label>
            <label>
              Warn score
              <input value={policy.warnScore} onChange={(event) => setPolicy({ ...policy, warnScore: event.target.value })} />
            </label>
            <label>
              Block score
              <input value={policy.blockScore} onChange={(event) => setPolicy({ ...policy, blockScore: event.target.value })} />
            </label>
            <label>
              High value motes
              <input value={policy.highValueMotes} onChange={(event) => setPolicy({ ...policy, highValueMotes: event.target.value })} />
            </label>
            <label>
              Block value motes
              <input value={policy.blockValueMotes} onChange={(event) => setPolicy({ ...policy, blockValueMotes: event.target.value })} />
            </label>
            <label>
              Max approval motes
              <input value={policy.maxApprovalMotes} onChange={(event) => setPolicy({ ...policy, maxApprovalMotes: event.target.value })} />
            </label>
            <label>
              Allowlist
              <textarea value={policy.allowlistedTargets} onChange={(event) => setPolicy({ ...policy, allowlistedTargets: event.target.value })} />
            </label>
            <label>
              Denylist
              <textarea value={policy.denylistedTargets} onChange={(event) => setPolicy({ ...policy, denylistedTargets: event.target.value })} />
            </label>
            <label>
              Denylisted wallets
              <textarea value={policy.denylistedWallets} onChange={(event) => setPolicy({ ...policy, denylistedWallets: event.target.value })} />
            </label>
          </div>
        </section>

        <div className="lowerGrid">
          <section className="panel" id="reports">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">Review history</p>
                <h2>Recent analyses</h2>
              </div>
              <button type="button" className="secondaryButton" onClick={() => { void refreshReports(); }}>Refresh</button>
            </div>
            <div className="tableHeader" role="row">
              <span>Wallet</span>
              <span>Risk</span>
              <span>Decision</span>
              <span>Casper</span>
            </div>
            <div className="reportList">
              {displayedReports.map((report) => (
                <button key={report.id} type="button" className="reportRow" onClick={() => { void loadReport(report.id); }}>
                  <span>{shorten(report.walletAddress)}</span>
                  <span className="riskCell"><i style={{ width: `${report.riskScore}%` }} /><b>{report.riskScore}</b></span>
                  <span className={`tablePill ${toneForDecision(report.decision)}`}>{report.decision}</span>
                  <span className={`tablePill ${toneForStatus(report.casperStatus)}`}>{formatStatus(report.casperStatus)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel detailPanel" id="detail">
            <div className="panelHeader">
              <div>
                <p className="sectionKicker">Evidence packet</p>
                <h2>{selectedReport?.id.slice(0, 12) ?? activeAnalysis.reportId}</h2>
              </div>
              <span>{formatStatus(selectedReport?.casperStatus ?? activeAnalysis.casperPublication.status)}</span>
            </div>
            <div className="detailGrid">
              <Metric label="Decision" value={selectedReport?.decision ?? activeAnalysis.decision} accent={scoreTone} />
              <Metric label="Risk" value={(selectedReport?.riskScore ?? activeAnalysis.riskScore.value).toString()} accent="danger" />
              <Metric label="Policy" value={selectedReport?.policyVersion ?? activeAnalysis.policyVersion} accent="info" />
              <Metric label="Casper" value={formatStatus(selectedReport?.casperStatus ?? activeAnalysis.casperPublication.status)} accent="secure" />
              <Metric label="Casper tx" value={selectedReport?.casperTransactionHash !== undefined ? shorten(selectedReport.casperTransactionHash) : "No hash claimed"} accent="warning" />
              <Metric label="Explanation" value={shorten(selectedReport?.explanationHash ?? activeAnalysis.explanationHash)} accent="info" />
            </div>
            <p className="muted detailNote">
              {selectedReport?.casperErrorMessage ?? activeAnalysis.casperPublication.reason}
            </p>
            <div className="detailActions">
              <button
                type="button"
                className="secondaryButton"
                disabled={isPublishing || selectedReport?.casperStatus === "confirmed"}
                onClick={() => { void retryPublication(selectedReport?.id ?? activeAnalysis.reportId); }}
              >
                {isPublishing ? "Queueing" : "Queue Casper attestation"}
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function isErrorResponse(value: AnalyzeResponse | { error?: { message?: string } }): value is { error?: { message?: string } } {
  return "error" in value;
}

function buildIntent(
  mode: AnalyzeMode,
  walletAddress: string,
  target: string,
  amountMotes: string,
  entryPoint: string,
) {
  if (mode === "block") {
    return {
      walletAddress,
      chainName: "casper-testnet",
      transactionKind: "APPROVAL",
      target,
      entryPoint,
      approvalScope: { spender: target, unlimited: true },
      args: { spender: target, amount: "unlimited" },
      clientContext: { source: "dashboard" },
    };
  }

  return {
    walletAddress,
    chainName: "casper-testnet",
    transactionKind: mode === "safe" ? "TRANSFER" : "CONTRACT_CALL",
    target,
    entryPoint,
    amountMotes,
    args: mode === "safe" ? {} : { recipient: "account-hash-recipient" },
    clientContext: { source: "dashboard" },
  };
}

function buildPolicyPayload(policy: PolicySettings) {
  return {
    version: policy.version,
    warnScore: parsePolicyInteger(policy.warnScore, 40),
    blockScore: parsePolicyInteger(policy.blockScore, 80),
    highValueMotes: policy.highValueMotes,
    blockValueMotes: policy.blockValueMotes,
    maxApprovalMotes: policy.maxApprovalMotes,
    allowlistedTargets: parseList(policy.allowlistedTargets),
    denylistedTargets: parseList(policy.denylistedTargets),
    denylistedWallets: parseList(policy.denylistedWallets),
    knownContracts: Object.fromEntries(
      parseList(policy.allowlistedTargets).map((contractHash) => [
        contractHash,
        { verified: true, name: "Policy allowlisted contract" },
      ]),
    ),
  };
}

function parsePolicyInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function parseList(value: string): readonly string[] {
  return value
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function Metric({ label, value, accent = "info" }: Readonly<{ label: string; value: string; accent?: string }>) {
  return (
    <div className={`metric ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EvidenceList({ title, items }: Readonly<{ title: string; items: readonly string[] }>) {
  return (
    <div className="evidenceList">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">None</p>
      )}
    </div>
  );
}

function labelForMode(mode: AnalyzeMode): string {
  if (mode === "safe") return "Trusted transfer";
  if (mode === "warning") return "Unknown contract";
  return "Blocked approval";
}

function toneForDecision(decision: DecisionAction): string {
  if (decision === "APPROVE") return "approve";
  if (decision === "WARN") return "warn";
  return "block";
}

function toneForStatus(status: CasperStatus): string {
  if (status === "confirmed") return "approve";
  if (status === "submitted" || status === "queued") return "warn";
  if (status === "failed") return "block";
  return "idle";
}

function formatStatus(status: CasperStatus): string {
  return status.replace(/_/gu, " ");
}

function pipelineSteps(analysis: AnalyzeResponse): readonly { label: string; detail: string; state: string }[] {
  return [
    { label: "Intent", detail: "Captured unsigned", state: "complete" },
    { label: "Risk", detail: `${analysis.signals.length} detectors`, state: "complete" },
    { label: "Decision", detail: analysis.decision, state: toneForDecision(analysis.decision) },
    { label: "Casper", detail: formatStatus(analysis.casperPublication.status), state: toneForStatus(analysis.casperPublication.status) },
  ];
}

function toReportSummary(analysis: AnalyzeResponse): ReportSummary {
  return {
    id: analysis.reportId,
    walletAddress: "account-hash-sender",
    target: "hash-blocked-contract",
    transactionKind: "APPROVAL",
    riskScore: analysis.riskScore.value,
    riskBand: analysis.riskScore.band,
    decision: analysis.decision,
    policyVersion: analysis.policyVersion,
    casperStatus: analysis.casperPublication.status,
    createdAt: analysis.createdAt,
  };
}

function toStoredReport(analysis: AnalyzeResponse): StoredReport {
  return {
    ...toReportSummary(analysis),
    traceId: analysis.traceId,
    explanation: analysis.explanation,
    explanationHash: analysis.explanationHash,
    metadataHash: "hash-demo-metadata",
    intentHash: "hash-demo-intent",
    confidence: analysis.riskScore.confidence,
    signals: analysis.signals,
    reasons: analysis.reasons,
    requiredUserMessage: analysis.requiredUserMessage,
  };
}

function shorten(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

