# Casper Sentinel AI

> Autonomous security layer for AI agents and Casper transactions.

Casper Sentinel AI is an autonomous pre-execution security agent for Casper transactions. Before a
wallet or AI agent signs a transaction, Sentinel evaluates the intent, contract risk, wallet
behavior, policy fit, and suspicious indicators, then returns an explainable `APPROVE`, `WARN`, or
`BLOCK` decision. Each decision is designed to be recorded on Casper Testnet as a transparent
security report.

## Evaluate in 5 minutes

**What it is** — A security checkpoint that screens a Casper transaction *before* it is signed, and
returns a deterministic `APPROVE` / `WARN` / `BLOCK` decision with an evidence-backed explanation.

**Why it matters** — AI agents now sign and call contracts faster than any human can review them. A
wallet prompt assumes a person is watching; agents break that assumption. Sentinel restores a
reviewable control point between intent and signature.

**What makes it agentic** — Sentinel acts on unsigned intent on its own: it runs a detector stack,
scores risk, and decides the outcome without a human in the loop. The AI writes the human-readable
rationale (observed evidence vs. inferred risk); it can *explain* the decision but can never change
it — the verdict is deterministic policy.

**What runs on Casper** — A Rust `risk-report-registry` contract, **live and verified on Casper
Testnet**, stores compact risk-report attestations (`record_report` / `get_report`).
Contract `hash-f8843bf7…46a0eda0` · [view the install deploy on cspr.live](https://testnet.cspr.live/deploy/0a4dc7c4d7cc7ac042b014ed9be206b83fc2f5f8cbc2a09a336f8ecea04a90e7).

**Test it now (no install)**

1. Open the live console → https://casper-sentineldashboard-production.up.railway.app/app
2. Pick the **Safe**, **Warning**, or **Block** scenario and press **Analyze intent**.
3. Read the decision, risk dial, detector signals, and the evidence-vs-inference explanation.
4. Open a row in **Recent analyses** to inspect the Casper attestation packet.
5. Toggle the theme (top right) — Professional Dark / Light, persisted across reloads.

> If the API is unreachable, **Load demo case** shows a full local example. The demo never claims a
> Casper transaction hash — no blockchain interaction is ever faked.

Deep detail (architecture, API, contract, phase log) follows below.

## MVP Scope

- Wallet connection for Casper users.
- Transaction intent capture before signing.
- Rule-based risk scoring engine.
- Smart contract and wallet risk inspection.
- AI-generated explanation that separates observed evidence from inferred risk.
- Autonomous `APPROVE`, `WARN`, or `BLOCK` decision.
- Casper Testnet contract for storing risk report attestations.
- Responsive enterprise dashboard showing analysis history.

## Technology Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | Fast TypeScript workspace with clear package boundaries. |
| Web dashboard | Next.js + React + TypeScript | Production-grade full-stack UI with server components and API routes when useful. |
| Styling | CSS design tokens (two-theme system) | Premium security UI (Professional Dark / Light) without crypto-casino styling; themed via CSS variables on `[data-theme]`. |
| API service | Fastify + TypeScript | Small, fast, typed HTTP boundary for screening, audits, and Casper adapters. |
| Domain packages | TypeScript packages | Shared strict models, risk engine, policies, and utilities across API and dashboard. |
| Validation | Zod | Runtime input validation at public boundaries. |
| Persistence | PostgreSQL + Prisma | Durable audit trail and simple local development path. |
| Queue/events | BullMQ + Redis | Async Casper writes, LLM calls, and indexing jobs without blocking user flow. |
| AI provider | Provider adapter interface | Allows OpenAI, local, or later multi-agent providers without changing domain logic. |
| Casper client | Official Casper JS SDK / JSON-RPC / SSE | Chain reads, transaction status, and event monitoring. |
| Smart contract | Rust + Casper crates compiled to Wasm | Native Casper contract development path. |
| Testing | Vitest, Playwright, cargo test | Unit, integration, UI, and contract coverage. |

## Current Folder Structure

```text
casper-sentinel/
  apps/
    api/                 Fastify API shell
    dashboard/           Next.js security console shell
    worker/              Async job process shell
  packages/
    ai-agent/            AI analyst provider contract and deterministic fallback
    casper/              Casper publisher interfaces and attestation types
    config/              Typed runtime configuration
    core/                Existing Python prototype kept untouched
    domain/              Shared intent, risk, decision, and report models
    risk-engine/         Detector interface and risk score aggregation
    testkit/             Test fixtures
    ui/                  Shared visual tokens
  contracts/
    risk-report-registry/ Rust risk report registry contract core
  docs/
    decisions/           Architecture decision records
```

## Architecture

Sentinel follows clean architecture with feature-first application modules:

- Presentation: dashboard screens, wallet connection UI, report views.
- Application: use cases such as `AnalyzeTransaction`, `PublishRiskReport`, and `ListReports`.
- Domain: transaction intent, risk signals, score aggregation, policies, decisions, reports.
- Infrastructure: Casper RPC/SSE, database, queues, AI provider, logging, secrets.
- Contracts: Casper Rust/Wasm contract storing risk report attestations.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), and
[docs/decisions/0001-architecture-stack.md](./docs/decisions/0001-architecture-stack.md), [docs/threat-model.md](./docs/threat-model.md), [docs/demo-script.md](./docs/demo-script.md), [docs/extension-readiness.md](./docs/extension-readiness.md), and [docs/casper-testnet-runbook.md](./docs/casper-testnet-runbook.md).

## Installation

Required local tools:

- Node.js 22 or newer.
- pnpm 10 or newer.
- Rust and Cargo.

```bash
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install
```

## Running Locally

```bash
cp .env.example .env
pnpm dev
```

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo test
```

The API health endpoint is `GET /v1/health` once `apps/api` is running. The dashboard dev server
runs on port `3000` by default.


## API Vertical Slice

`POST /v1/analyze` accepts an unsigned transaction intent and optional policy overrides:

```json
{
  "intent": {
    "walletAddress": "account-hash-sender",
    "chainName": "casper-testnet",
    "transactionKind": "TRANSFER",
    "target": "hash-trusted-contract",
    "amountMotes": "2500000000",
    "args": {},
    "clientContext": {}
  }
}
```

The endpoint returns a deterministic security decision with evidence-backed signals and a grounded
AI analyst explanation. Successful analyses are stored in the durable local report repository and can be
retrieved through `GET /v1/reports` and `GET /v1/reports/:id`. Successful analyses enter `queued` Casper publication status. The worker and publisher package can advance a report to `submitted`, `confirmed`, or `failed` only from an injected Casper gateway result; the API never fabricates a transaction hash.

## AI Analyst Contract

The AI analyst is provider-neutral. Providers receive only sanitized structured evidence, never raw
secrets or private key material. Provider output must match this contract:

```json
{
  "observedEvidence": ["facts from supplied detector evidence"],
  "inferredRisk": ["clearly labeled inferences from supplied signals"],
  "recommendation": "human-readable recommendation matching the deterministic decision",
  "confidence": 0.88
}
```

Invalid provider output or provider failure falls back to a deterministic explanation. The provider
can explain the decision, but it cannot change `APPROVE`, `WARN`, or `BLOCK`.

## Dashboard Workflow

The dashboard now opens with a professional product landing page explaining what Sentinel is, why it matters, how it works, and FAQ. The launched console is a judge-ready security command center that lets a user enter a wallet address,
prepare safe, warning, or blocking transaction intents, submit analysis to the API, inspect the
analyst explanation, open saved report detail from the audit trail, and use a clearly labeled local
judge demo when the API is unavailable. The local demo never claims a Casper transaction hash.

Run the API and dashboard in separate terminals:

```bash
corepack pnpm --filter @casper-sentinel/api dev
corepack pnpm --filter @casper-sentinel/dashboard dev
```

The dashboard expects the API at `http://localhost:4000` unless `NEXT_PUBLIC_API_URL` is set. The API stores local report history at `REPORT_STORE_PATH`, defaulting to `.data/risk-reports.json`.

## Deployment

The stack is deployed on Railway (project `poetic-mercy`):

- Dashboard (Next.js): https://casper-sentineldashboard-production.up.railway.app
- API (Fastify): https://casper-sentinelapi-production.up.railway.app
- Worker: background service (no public port).
- PostgreSQL and Redis run as managed Railway services.
- Casper Testnet contract deployed from `contracts/risk-report-registry` (see below).
- Worker configured with `JsonRpcCasperDeployGateway`; live report publication still requires an injected signer, and no private key is stored in this repo.

Build details: Railpack builds each service, with a root `railpack.json` pinning the Node provider (the repo also contains a Rust contract, which would otherwise be auto-detected), and each service builds its workspace dependencies first via `turbo run build --filter=<service>`. `casper-client 5.0.1` is installed inside Ubuntu WSL because the native Windows Cargo build fails on Unix-only Casper dependencies.

## Smart Contract Deployment

The risk report registry is **live on Casper Testnet** (`casper-test`), verified on-chain:

| Field | Value |
| --- | --- |
| Contract hash | `contract-f8843bf75c839024172e7288b56c1966d30d959132fc2c73120e633046a0eda0` |
| Contract package hash | `contract-package-75631e7e6ab6b546551aca4b69b5f7cd19901f8b6abc5c94ac4f7dc48aa22b50` |
| Install deploy hash | `0a4dc7c4d7cc7ac042b014ed9be206b83fc2f5f8cbc2a09a336f8ecea04a90e7` |
| Deploy account | `0202f44ecf8e3d2dabf6b8f29625a7584994a76586b9b08b4bbe4df294fbaac2956b` |
| Block height | 8362445 |
| Gas consumed | 65576079361 motes |

Re-verified live on 2026-07-01: the install deploy executed with no error, and the contract hash resolves in Testnet global state to the package and Wasm hashes above. Confirm independently on [cspr.live](https://testnet.cspr.live/deploy/0a4dc7c4d7cc7ac042b014ed9be206b83fc2f5f8cbc2a09a336f8ecea04a90e7) or via `casper-client query-global-state --key hash-f8843bf75c839024172e7288b56c1966d30d959132fc2c73120e633046a0eda0`.

Set `CASPER_RISK_REPORT_CONTRACT_HASH` to the contract hash above. Full operational detail is in [docs/casper-testnet-runbook.md](./docs/casper-testnet-runbook.md).

To rebuild the local Wasm artifact:

```bash
rustup target add wasm32v1-none
RUSTC_BOOTSTRAP=1 RUSTFLAGS="-C link-arg=--allow-undefined" \
  cargo build -p risk-report-registry --target wasm32v1-none --release
```

This matches the target and flags used for the deployed artifact and by `scripts/deploy-casper-testnet.ps1`.

Submit to Casper Testnet only after providing a funded deploy key. The PowerShell script uses native `casper-client` when available and falls back to the installed Ubuntu WSL client:

```powershell
.\\scripts\\deploy-casper-testnet.ps1 -SecretKeyPath C:\\path\\to\\funded-testnet-secret-key.pem
```

The script refuses to deploy without a Casper client, the Wasm artifact, and a real key path. In this environment the verified client is `Casper client 5.0.1` inside Ubuntu WSL.

## Screenshots

Use the demo script to capture the landing page, `SAFE`, `WARNING`, `BLOCK`, local judge demo, and publication retry flows after starting the local API and dashboard.

## Demo Flow

1. User connects a Casper wallet.
2. User prepares a transfer or contract call.
3. Sentinel captures the unsigned transaction intent.
4. Risk engine runs deterministic detectors.
5. AI analyst produces a concise explanation grounded in detector evidence.
6. Decision engine returns `APPROVE`, `WARN`, or `BLOCK`.
7. API queues a Casper Testnet report attestation.
8. Dashboard displays the report, score, reasoning, and Casper publication status.

## Hackathon Compliance Checklist

- [x] Uses Casper Testnet.
- [x] Includes a Casper smart contract.
- [x] Stores verifiable risk report data or references on-chain.
- [x] Provides an autonomous agent workflow (screens unsigned intent and decides pre-signature, no human in the loop).
- [x] Includes wallet connection.
- [x] Demonstrates transaction analysis before execution.
- [x] Shows transparent dashboard audit history.
- [x] Includes complete README, architecture, and roadmap.

## Development Status

Current phase: **Deployed - dashboard, API, and worker live on Railway; risk report registry deployed and verified on Casper Testnet (install deploy `0a4dc7c4…`, block 8362445).**

Phase 1 completed:

- Root pnpm/Turbo/TypeScript/ESLint/Prettier configuration.
- API, dashboard, and worker shells.
- Shared TypeScript domain, risk engine, AI agent, Casper, config, UI, and testkit packages.
- Rust contract-domain validation crate with local tests.

Phase 2 completed:

- Policy-aware transaction intent, risk signal, score, decision, and report models.
- MVP detector registry with value, target, approval scope, malformed input, policy list, and metadata detectors.
- Bounded weighted scoring and confidence aggregation.
- Decision engine for `APPROVE`, `WARN`, and `BLOCK`, including hard-block policy overrides.
- Safe, warning, and blocking fixtures with detector and scenario tests.

Phase 3 completed:

- `POST /v1/analyze` validates transaction intent and optional policy overrides with Zod.
- The API returns `APPROVE`, `WARN`, or `BLOCK` using the deterministic risk engine.
- Responses include trace ID, score, signals, reasons, policy version, and deterministic explanation fields.
- Invalid input returns a stable `VALIDATION_ERROR` response.
- Casper publication was intentionally left unqueued in this phase and no chain result was simulated.

Phase 4 completed:

- Provider-neutral AI analyst interface with injectable providers.
- Sanitized prompt assembly that redacts secret-like keys before provider calls.
- Prompt contract requiring observed evidence, inferred risk, recommendation, and confidence.
- Strict explanation output validation with deterministic fallback on provider errors or invalid output.
- Stable SHA-256 explanation hashes for later report attestations.
- API responses now include `explanation.source`, `promptVersion`, and `explanationHash`.

Phase 5 completed:

- PostgreSQL/Prisma schema for risk reports and detector signals.
- Durable local report repository for MVP runs and in-process repository for API tests.
- `POST /v1/analyze` now stores each successful analysis as a risk report.
- `GET /v1/reports` and `GET /v1/reports/:id` expose audit history and detail.
- Dashboard includes wallet connection surface, analyze form, decision panel, analyst explanation, report list, and report detail.

Phase 6 completed:

- Rust `risk-report-registry` contract core with `record_report`, `get_report`, wallet indexing, and `ReportRecorded` event semantics.
- TypeScript Casper publisher package with attestation validation and `record_report` deploy-call payload construction.
- Worker publication job that moves queued reports to `submitted`, `confirmed`, or `failed` only from publisher results.
- API publication queue endpoint: `POST /v1/casper/reports/:id/publish`.
- Dashboard report detail now surfaces Casper status, transaction hash when present, and publication errors.

Phase 7 completed:

- Threat model covering assets, trust boundaries, primary threats, controls, and residual risk.
- Dashboard policy settings for thresholds, allowlists, denylists, and denylisted wallets.
- Idempotent Casper publication retry handling with conflict protection for competing keys.
- Dashboard loading, empty, failure, refresh, and retry states for the demo path.
- Demo script for safe, warning, blocking, and publication retry flows.
- Responsive policy/detail layout refinements for mobile and desktop review.

Phase 8 completed:

- `@casper-sentinel/extensions` package with MCP, x402, agent orchestration, monitoring, and tenant/RBAC interfaces.
- Manifest validation helpers for extension IDs, permissions, required secrets, and monitoring schedule safety.
- RBAC helper for tenant-scoped permission checks.
- Extension readiness document describing contracts, invariants, and future implementation path.

Phase 9 completed:

- Live Casper JSON-RPC gateway for submitting already-signed `record_report` transactions.
- Default `account_put_transaction` support with legacy `account_put_deploy` compatibility mode.
- Explicit confirmation polling that only confirms after execution result data appears.
- Live readiness validation for RPC, SSE, contract hash, and publisher public key configuration.
- Casper Testnet publication runbook that separates readiness from an actual submitted transaction.

Hackathon polish completed:

- Command-center dashboard redesign with stronger first impression, responsive layouts, and judge-safe local demo mode.
- Clearer AI reasoning, detector stack, audit trail, and attestation packet presentation.
- Local contract Wasm build verified for the `wasm32v1-none` Casper target.
- Guarded Casper Testnet deployment script added under `scripts/deploy-casper-testnet.ps1`, with native/WSL client support.

Next work: provide a funded Testnet key path, deploy the contract to Testnet, then publish one real queued report and record the transaction evidence.

## References

- [Casper official developer docs](https://docs.casper.network/developers)
- [Casper official Rust crates](https://docs.casper.network/developers/essential-crates)
- [Casper event monitoring docs](https://docs.casper.network/developers/monitor-and-consume-events)
