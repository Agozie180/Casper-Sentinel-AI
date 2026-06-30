"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type DecisionAction = "APPROVE" | "WARN" | "BLOCK";
type TransactionKind = "TRANSFER" | "CONTRACT_CALL" | "APPROVAL" | "UNKNOWN";

type ReportSummary = {
  readonly id: string;
  readonly walletAddress: string;
  readonly target: string;
  readonly transactionKind: TransactionKind;
  readonly riskScore: number;
  readonly riskBand: string;
  readonly decision: DecisionAction;
  readonly policyVersion: string;
  readonly casperStatus: string;
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
  readonly casperPublication: { readonly status: string; readonly reason: string };
};

type StoredReport = ReportSummary & {
  readonly traceId: string;
  readonly explanation: Explanation;
  readonly explanationHash: string;
  readonly metadataHash: string;
  readonly intentHash: string;
  readonly confidence: number;
  readonly signals: readonly RiskSignal[];
  readonly reasons: readonly string[];
  readonly requiredUserMessage: string;
};

type AnalyzeMode = "safe" | "warning" | "block";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const navigationItems = ["Analyze", "Reports", "Detail"] as const;

export function SentinelConsole() {
  const [walletAddress, setWalletAddress] = useState("account-hash-sender");
  const [connectedWallet, setConnectedWallet] = useState<string | undefined>();
  const [target, setTarget] = useState("hash-trusted-contract");
  const [amountMotes, setAmountMotes] = useState("2500000000");
  const [entryPoint, setEntryPoint] = useState("transfer");
  const [mode, setMode] = useState<AnalyzeMode>("safe");
  const [reports, setReports] = useState<readonly ReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<StoredReport | undefined>();
  const [analysis, setAnalysis] = useState<AnalyzeResponse | undefined>();
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const activeWallet = connectedWallet ?? walletAddress;
  const scoreTone = analysis?.decision.toLowerCase() ?? "idle";

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report history is unavailable.");
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
        body: JSON.stringify({ intent: intentPreview }),
      });
      const body = (await response.json()) as AnalyzeResponse | { error?: { message?: string } };
      if (!response.ok || isErrorResponse(body)) {
        throw new Error(isErrorResponse(body) ? body.error?.message ?? "Analysis failed." : "Analysis failed.");
      }

      setAnalysis(body);
      setStatus(body.decision);
      await refreshReports();
      await loadReport(body.reportId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
      setStatus("Error");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadReport(id: string) {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/reports/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Report detail is unavailable.");
      const body = (await response.json()) as { report: StoredReport };
      setSelectedReport(body.report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report detail is unavailable.");
    }
  }

  function connectWallet() {
    setConnectedWallet(walletAddress.trim());
    setStatus("Wallet connected");
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

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div>
            <strong>Casper Sentinel</strong>
            <span>Testnet console</span>
          </div>
        </div>
        <nav>
          {navigationItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-label="Security workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Autonomous security layer</p>
            <h1>Transaction Analysis</h1>
          </div>
          <div className="statusCluster">
            <span className={`statusPill ${scoreTone}`}>{status}</span>
            <button type="button" onClick={connectWallet}>Connect Wallet</button>
          </div>
        </header>

        {error !== undefined ? <div className="alert">{error}</div> : null}

        <div className="analysisGrid">
          <section className="panel" id="analyze">
            <div className="panelHeader">
              <h2>Intent</h2>
              <span>{connectedWallet ?? "Wallet pending"}</span>
            </div>
            <form className="analysisForm" onSubmit={(event) => { void submitAnalysis(event); }}>
              <label>
                Wallet
                <input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} />
              </label>
              <label>
                Target
                <input value={target} onChange={(event) => setTarget(event.target.value)} />
              </label>
              <label>
                Amount motes
                <input value={amountMotes} onChange={(event) => setAmountMotes(event.target.value)} />
              </label>
              <label>
                Entry point
                <input value={entryPoint} onChange={(event) => setEntryPoint(event.target.value)} />
              </label>
              <div className="segmented" role="group" aria-label="Scenario">
                {(["safe", "warning", "block"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={mode === item ? "active" : ""}
                    onClick={() => applyMode(item)}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
              <button type="submit" disabled={isLoading}>{isLoading ? "Analyzing" : "Analyze"}</button>
            </form>
          </section>

          <section className="panel decisionPanel" aria-label="Decision state">
            <div className="panelHeader">
              <h2>Decision</h2>
              <span>{analysis?.riskScore.band ?? "No score"}</span>
            </div>
            <div className={`decisionBadge ${scoreTone}`}>{analysis?.decision ?? "PENDING"}</div>
            <div className="scoreGrid">
              <Metric label="Risk" value={analysis?.riskScore.value.toString() ?? "0"} />
              <Metric label="Confidence" value={analysis?.riskScore.confidence.toFixed(2) ?? "0.00"} />
              <Metric label="Signals" value={analysis?.signals.length.toString() ?? "0"} />
            </div>
            <p className="muted">{analysis?.requiredUserMessage ?? "Awaiting transaction intent."}</p>
          </section>
        </div>

        <section className="panel explanationPanel">
          <div className="panelHeader">
            <h2>Analyst Explanation</h2>
            <span>{analysis?.explanation.source ?? "fallback"}</span>
          </div>
          <div className="explanationGrid">
            <EvidenceList title="Observed" items={analysis?.explanation.observedEvidence ?? []} />
            <EvidenceList title="Inferred" items={analysis?.explanation.inferredRisk ?? []} />
          </div>
          <p className="recommendation">{analysis?.explanation.recommendation ?? "No recommendation yet."}</p>
        </section>

        <section className="panel" id="reports">
          <div className="panelHeader">
            <h2>Audit Trail</h2>
            <span>{reports.length} reports</span>
          </div>
          <div className="tableHeader" role="row">
            <span>Wallet</span>
            <span>Risk</span>
            <span>Decision</span>
            <span>Casper</span>
          </div>
          <div className="reportList">
            {reports.map((report) => (
              <button key={report.id} type="button" className="reportRow" onClick={() => { void loadReport(report.id); }}>
                <span>{shorten(report.walletAddress)}</span>
                <span>{report.riskScore}</span>
                <span>{report.decision}</span>
                <span>{report.casperStatus}</span>
              </button>
            ))}
            {reports.length === 0 ? <div className="emptyRow">No analyses recorded yet.</div> : null}
          </div>
        </section>

        <section className="panel detailPanel" id="detail">
          <div className="panelHeader">
            <h2>Report Detail</h2>
            <span>{selectedReport?.id.slice(0, 8) ?? "None"}</span>
          </div>
          {selectedReport !== undefined ? (
            <div className="detailGrid">
              <Metric label="Decision" value={selectedReport.decision} />
              <Metric label="Risk" value={selectedReport.riskScore.toString()} />
              <Metric label="Policy" value={selectedReport.policyVersion} />
              <Metric label="Casper" value={selectedReport.casperStatus} />
              <Metric label="Intent hash" value={shorten(selectedReport.intentHash)} />
              <Metric label="Explanation" value={shorten(selectedReport.explanationHash)} />
            </div>
          ) : (
            <div className="emptyRow">Select a report.</div>
          )}
        </section>
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

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="metric">
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

function shorten(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}




