# Architecture

Casper Sentinel AI is a pre-execution blockchain security platform. Its first product is an
autonomous security analyst that screens Casper transaction intent before signing and creates a
verifiable risk report on Casper Testnet.

## Objectives

- Prevent unsafe transactions before signature.
- Produce deterministic risk scores from auditable signals.
- Use an AI analyst only to interpret, summarize, and explain evidence.
- Record security decisions on Casper without claiming success until the chain confirms them.
- Keep the MVP modular enough for later MCP, x402, multi-agent, monitoring, and enterprise features.

## Architectural Style

The system uses clean architecture with feature-first modules.

```text
Presentation -> Application -> Domain <- Infrastructure
                                  ^
                                  |
                              Contracts
```

- Presentation depends on application use cases.
- Application orchestrates domain services and infrastructure ports.
- Domain contains pure business rules and no framework, database, AI, or chain dependencies.
- Infrastructure implements adapters for Casper, PostgreSQL, queues, logging, and AI providers.
- Contracts expose on-chain storage for report attestations.

## Runtime Components

```text
Wallet UI
  |
  v
Dashboard / Transaction Interceptor
  |
  v
API: AnalyzeTransaction use case
  |
  +--> Intent parser
  +--> Risk engine
  |     +--> Wallet reputation detectors
  |     +--> Contract inspection detectors
  |     +--> Approval scope detectors
  |     +--> Anomaly detectors
  |     +--> Policy detectors
  |
  +--> AI analyst explanation
  +--> Decision engine
  +--> Audit database write
  +--> Queue Casper report publication
  |
  v
APPROVE / WARN / BLOCK response

Worker
  |
  +--> Publish risk report to Casper Testnet contract
  +--> Confirm transaction status
  +--> Update audit trail with on-chain reference
```

## Core Domain Model

```text
TransactionIntent
  walletAddress
  chainName
  transactionKind
  target
  entryPoint
  amount
  args
  rawTransaction
  clientContext

RiskSignal
  id
  detectorId
  category
  severity
  confidence
  evidence
  observed
  inferred

RiskScore
  value: 0..100
  band: LOW | MEDIUM | HIGH | CRITICAL
  signals
  confidence

Decision
  action: APPROVE | WARN | BLOCK
  score
  reasons
  requiredUserMessage
  policyVersion

RiskReport
  id
  walletAddress
  transactionHash
  timestamp
  riskScore
  decision
  explanationHash
  metadataHash
  casperPublicationStatus
```

## Feature Boundaries

### Wallet

Connects the user's Casper wallet, reads public wallet identity, and captures unsigned transaction
intent. Wallet code must never handle private keys directly.

### Transaction Analysis

Validates the input, normalizes transaction fields, and calls the risk engine. This feature owns
the primary screen-first workflow.

### Risk Engine

Runs deterministic detectors and combines their signals into a bounded score. It must be pure,
unit-testable, and free of direct IO.

Initial MVP detectors:

- Unknown contract target.
- High-value transfer.
- Suspicious approval scope.
- Unusual wallet behavior compared with recent activity.
- Contract metadata missing or unverifiable.
- Policy denylist or allowlist hit.
- Malformed or ambiguous transaction arguments.

### AI Analyst

Turns structured evidence into a human-readable explanation. It must not invent chain facts. The
prompt contract must require separate sections for observed evidence, inferred risk, confidence,
and recommendation.

### Decision Engine

Maps score, confidence, hard rules, and policy thresholds to `APPROVE`, `WARN`, or `BLOCK`.
Hard-block policies always override the LLM explanation.

### Reports

Stores the full internal report in PostgreSQL and publishes only compact, privacy-aware
attestation fields to Casper Testnet. Large explanations should be hashed and optionally stored
off-chain later.

### Casper Publisher

Submits report data to the Casper contract through an explicit publisher gateway, tracks pending status, confirms success, and updates
the dashboard. The gateway boundary prevents the application from claiming submission or confirmation without a real deploy result. It must distinguish `queued`, `submitted`, `confirmed`, and `failed` states.

## Smart Contract Design

The Casper contract is a `risk-report-registry` written in Rust and compiled to Wasm.

Required storage fields:

- `wallet_address`
- `transaction_hash` when available
- `timestamp`
- `risk_score`
- `decision`
- `explanation_hash`
- `metadata_hash`

Entry points:

- `record_report(report)` stores a report attestation and emits a `ReportRecorded` event.
- `get_report(report_id)` returns a stored report.
- `get_reports_by_wallet(wallet_address)` supports dashboard lookups where feasible.

Security rules:

- Validate score bounds and decision enum.
- Hash long explanation and metadata payloads off-chain before submission.
- Use an authorized publisher key for MVP writes.
- Never mark a report confirmed until Casper confirms the transaction.

## Data Flow

1. UI builds `TransactionIntent` from an unsigned transaction.
2. API validates with Zod and assigns a trace ID.
3. Application layer loads wallet and contract context through ports.
4. Risk engine returns `RiskScore` with structured signals.
5. AI analyst receives only sanitized evidence and produces an explanation.
6. Decision engine applies policy thresholds.
7. API stores `RiskReport` with `queued` on-chain status.
8. Worker publishes attestation to Casper.
9. Worker updates report status after confirmation.
10. Dashboard shows the full audit trail.

## Security Principles

- Validate all public inputs with runtime schemas.
- Keep secrets only in server-side environment variables.
- Do not send private keys, seed phrases, or raw secrets to AI providers.
- Sanitize LLM context and never allow model output to override hard policy.
- Use idempotency keys for report publication.
- Rate limit screening and report endpoints.
- Log trace IDs and structured errors, not sensitive payloads.
- Fail closed for high-risk ambiguity; fail clearly for infrastructure outages.

## API Surface

```text
POST /v1/analyze
GET  /v1/reports
GET  /v1/reports/:id
GET  /v1/wallets/:address/summary
POST /v1/casper/reports/:id/publish
GET  /v1/health
```

The MVP dashboard can call these endpoints directly. A future public API can add tenant auth,
API keys, quotas, and webhook callbacks without changing the domain model.

## Database Sketch

```text
wallets
  address
  first_seen_at
  last_seen_at
  risk_summary

risk_reports
  id
  wallet_address
  transaction_hash
  intent_hash
  risk_score
  decision
  explanation
  explanation_hash
  metadata_hash
  policy_version
  casper_status
  casper_transaction_hash
  created_at
  updated_at

risk_signals
  id
  report_id
  detector_id
  category
  severity
  confidence
  evidence_json

contract_registry
  contract_hash
  known_name
  verification_status
  first_seen_at
  metadata_json
```

## UI Information Architecture

- Analyze: wallet connection, transaction preview, risk result, decision panel.
- Reports: searchable audit table with score, decision, wallet, date, and on-chain status.
- Report detail: evidence, AI explanation, detector signals, policy decision, Casper reference.
- Settings: local MVP policy thresholds, allowlist/denylist configuration, publication retry status, and idempotency feedback.

## Extension Points

- MCP tools can become infrastructure adapters behind existing ports.
- x402 payments can gate API access without touching the risk engine.
- Multi-agent analysis can replace the single AI analyst provider.
- Portfolio monitoring can reuse wallet context and detectors on scheduled jobs.
- Enterprise dashboard can add tenancy, RBAC, and policy versions.
- Browser extension can call the same `AnalyzeTransaction` API.
- Live Casper publication can swap signer implementations behind `SignedCasperTransactionFactory` without changing report storage or dashboard status handling.

## Source Notes

Casper is a smart-contracting platform backed by Proof-of-Stake and WebAssembly. Official Casper
docs list Rust crates including `casper-contract`, `casper-types`, `casper-client`,
`casper-event-standard`, and `cargo-casper`, and document JSON-RPC plus SSE event monitoring for
dApps. The contract and chain adapters should follow those official interfaces.
