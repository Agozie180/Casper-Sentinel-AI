# Casper Sentinel AI

> The Autonomous Security Layer for AI Agents.

Casper Sentinel AI is an autonomous pre-execution security agent for Casper transactions. Before a
wallet or AI agent signs a transaction, Sentinel evaluates the intent, contract risk, wallet
behavior, policy fit, and suspicious indicators, then returns an explainable `APPROVE`, `WARN`, or
`BLOCK` decision. Each decision is designed to be recorded on Casper Testnet as a transparent
security report.

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
| Styling | Tailwind CSS + shared UI tokens | Premium dark security UI without crypto-casino styling. |
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
[docs/decisions/0001-architecture-stack.md](./docs/decisions/0001-architecture-stack.md), [docs/threat-model.md](./docs/threat-model.md), and [docs/demo-script.md](./docs/demo-script.md).

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

The dashboard is a functional local security console. It lets a user enter a wallet address,
prepare safe, warning, or blocking transaction intents, submit analysis to the API, inspect the
analyst explanation, and open saved report detail from the audit trail.

Run the API and dashboard in separate terminals:

```bash
corepack pnpm --filter @casper-sentinel/api dev
corepack pnpm --filter @casper-sentinel/dashboard dev
```

The dashboard expects the API at `http://localhost:4000` unless `NEXT_PUBLIC_API_URL` is set. The API stores local report history at `REPORT_STORE_PATH`, defaulting to `.data/risk-reports.json`.

## Deployment

Deployment is not wired yet. The intended MVP deployment shape is:

- Dashboard on a Node-compatible web host.
- API and worker as separate server processes.
- PostgreSQL and Redis as managed services.
- Casper Testnet contract deployed from `contracts/risk-report-registry` once runtime bindings are implemented.

No deployment command should claim success until all infrastructure and Casper transactions are
confirmed.

## Screenshots

Use the demo script to capture the dashboard states for `SAFE`, `WARNING`, `BLOCK`, and publication retry flows after starting the local API and dashboard.

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

- [ ] Uses Casper Testnet.
- [ ] Includes a Casper smart contract.
- [ ] Stores verifiable risk report data or references on-chain.
- [ ] Provides an autonomous agent workflow.
- [ ] Includes wallet connection.
- [ ] Demonstrates transaction analysis before execution.
- [ ] Shows transparent dashboard audit history.
- [x] Includes complete README, architecture, and roadmap.

## Development Status

Current phase: **Phase 8 - Post-MVP Extension Readiness**.

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

Next phase: define post-MVP extension interfaces for MCP, x402, multi-agent orchestration, monitoring, and enterprise tenancy.

## References

- [Casper official developer docs](https://docs.casper.network/developers)
- [Casper official Rust crates](https://docs.casper.network/developers/essential-crates)
- [Casper event monitoring docs](https://docs.casper.network/developers/monitor-and-consume-events)










