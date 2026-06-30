# 0001 - TypeScript Application Core and Rust Casper Contract

Date: 2026-06-30

## Status

Accepted for MVP scaffolding.

## Context

Casper Sentinel AI needs a strict, auditable application codebase and a native Casper smart
contract path. The build brief requires clean architecture, feature-first organization, strict
TypeScript, secure defaults, and Casper Testnet report storage.

## Decision

Use a pnpm workspace with TypeScript packages for domain, risk engine, AI analyst, Casper adapters,
configuration, UI primitives, and test fixtures. Use Rust for the Casper risk report registry
contract. Keep the existing Python prototype untouched as exploratory legacy code until there is an
explicit migration or archival decision.

## Consequences

- Shared domain types can be reused by the API, dashboard, worker, and SDKs.
- The risk engine remains deterministic and testable outside infrastructure.
- Casper runtime bindings are isolated from product logic.
- pnpm must be installed before TypeScript verification commands can run locally.
