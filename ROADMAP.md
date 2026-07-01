# Implementation Roadmap

This roadmap keeps Casper Sentinel AI moving in small, testable phases. Each phase should end in a
commit-ready state with documentation updated and broken code avoided.

## Phase 0 - Architecture and Planning

Objective: define the system before production implementation.

Tasks:

- Align product scope with the Casper Agentic Buildathon MVP.
- Select the TypeScript + Rust technology stack.
- Define clean architecture boundaries.
- Define target folder structure.
- Define the Casper smart contract responsibilities.
- Document security principles and implementation phases.

Exit criteria:

- README, architecture, and roadmap are current.
- The team agrees the existing Python prototype is either archived or migrated later.

Status: complete for initial planning.

## Phase 1 - Workspace Foundation

Status: complete.

Objective: scaffold a strict, maintainable monorepo.

Tasks:

- Create pnpm workspace and Turborepo config.
- Add shared TypeScript config, ESLint, Prettier, and Vitest.
- Create `apps/dashboard`, `apps/api`, `apps/worker`, and shared packages.
- Add Rust contract workspace under `contracts/risk-report-registry`.
- Add environment template and typed config loader.
- Add CI-ready commands for lint, typecheck, test, and build.

Tests:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `cargo test`

Exit criteria:

- Empty apps and packages compile.
- Quality gates run locally.

## Phase 2 - Domain and Risk Engine

Status: complete.

Objective: implement deterministic analysis without external services.

Tasks:

- Define `TransactionIntent`, `RiskSignal`, `RiskScore`, `Decision`, and `RiskReport`.
- Implement detector interface and registry.
- Add MVP detectors for value, target, approval scope, malformed args, policy lists, and missing metadata.
- Implement bounded scoring and confidence calculation.
- Implement decision thresholds and hard-block policies.
- Add fixtures for safe, warning, and blocking scenarios.

Tests:

- Unit tests for every detector.
- Score aggregation tests.
- Policy override tests.

Exit criteria:

- A transaction intent can be scored and converted into `APPROVE`, `WARN`, or `BLOCK` in memory.

## Phase 3 - API Vertical Slice

Status: complete.

Objective: expose transaction analysis through a real HTTP endpoint.

Tasks:

- Build Fastify API shell.
- Add `POST /v1/analyze`.
- Validate requests with Zod.
- Return structured decision, score, signals, and deterministic evidence-backed explanation.
- Add structured logging and trace IDs.
- Add error handling and rate-limit guardrails.

Tests:

- API contract tests.
- Invalid input tests.
- Snapshot tests for decision response shape.

Exit criteria:

- `POST /v1/analyze` works end-to-end without AI or Casper publication.

## Phase 4 - AI Analyst

Status: complete.

Objective: add grounded natural-language explanations.

Tasks:

- Create provider-neutral AI interface.
- Add prompt contract requiring observed evidence, inferred risk, confidence, and recommendation.
- Add sanitization so only safe structured evidence reaches the provider.
- Add fallback deterministic explanation for provider failures.
- Store explanation hash with the report model.

Tests:

- Prompt assembly tests.
- Redaction tests.
- Provider failure tests.
- Explanation schema validation tests.

Exit criteria:

- API returns a concise AI explanation without allowing model output to change hard policy decisions.

## Phase 5 - Persistence and Dashboard

Status: complete.

Objective: make the product visible and auditable.

Tasks:

- Add PostgreSQL schema and Prisma models.
- Persist reports and detector signals.
- Build dashboard shell with professional dark security UI.
- Implement wallet connection surface.
- Implement Analyze screen with transaction preview and result panel.
- Implement Reports list and Report detail pages.

Tests:

- Repository integration tests.
- Playwright smoke tests for dashboard flows.
- Responsive layout checks.

Exit criteria:

- A user can connect a wallet, submit an analysis, and view the saved report history.

## Phase 6 - Casper Contract and Publisher

Status: complete.

Objective: record verifiable risk report attestations on Casper Testnet.

Tasks:

- Implement `risk-report-registry` Rust contract.
- Add `record_report`, `get_report`, and event emission.
- Add contract-core tests for storage, lookup, duplicate rejection, and event semantics.
- Build TypeScript Casper publisher adapter.
- Add worker job for queued report publication.
- Track `queued`, `submitted`, `confirmed`, and `failed` states.

Tests:

- Contract unit/integration tests.
- Publisher adapter tests with mocks.
- Publisher gateway tests proving submitted, confirmed, and failed states without fabricated transactions.

Exit criteria:

- A risk report can be queued, converted into a compact Casper attestation, submitted through a publisher gateway, and displayed with a confirmed on-chain reference only when the gateway confirms it.

## Phase 7 - MVP Hardening

Status: complete.

Objective: make the demo credible as a startup MVP.

Tasks:

- Add threat model document.
- Add policy settings UI.
- Add allowlist/denylist management.
- Add idempotency keys for report publication.
- Add loading, empty, failure, and retry states.
- Add README screenshots and demo script.
- Run responsive layout checks through build and dashboard type/lint gates.

Tests:

- Demo script path for safe, warning, blocking, and publication retry flows.
- Security-focused negative tests.
- Build and lint gates.

Exit criteria:

- The MVP can be demoed reliably from wallet connection through on-chain report audit trail.

## Phase 8 - Post-MVP Extension Readiness

Status: complete.

Objective: prepare for stretch features without implementing them prematurely.

Tasks:

- Define MCP adapter interface.
- Define payment/entitlement boundary for x402.
- Define agent orchestration interface.
- Define monitoring job scheduler boundary.
- Define tenant/RBAC model for enterprise dashboard.

Exit criteria:

- Stretch features have documented interfaces and do not require rewriting the MVP core.
- MVP phase roadmap is complete; future work should select a live extension or Casper deployment task.

## Phase 9 - Live Casper Testnet Readiness

Status: complete.

Objective: make the Casper publication boundary ready for a real Testnet transaction without fabricating signer output, transaction hashes, or confirmations.

Tasks:

- Add a JSON-RPC Casper gateway that submits signer-produced payloads through `account_put_transaction`.
- Keep legacy `account_put_deploy` compatibility behind an explicit mode.
- Add confirmation polling that returns confirmed only from execution-result status data.
- Add live readiness validation for RPC URL, SSE URL, contract hash, and publisher public key.
- Document the Testnet runbook, current limitations, and exact conditions required before claiming a live transaction.

Tests:

- JSON-RPC request-shape tests.
- Transaction hash extraction tests.
- Pending versus confirmed polling tests.
- Readiness validation tests.

Exit criteria:

- The worker can be wired to a real Casper gateway once a secure signer and deployed contract hash are supplied.
- The repo documents that no live Testnet transaction is claimed until JSON-RPC returns a hash and polling returns execution result data.

Next work: implement the secure signer and Casper Wasm runtime wrapper, deploy to Testnet, then submit one real report attestation.
