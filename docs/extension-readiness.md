# Post-MVP Extension Readiness

Phase 8 defines contracts for stretch capabilities without implementing those systems in the MVP runtime. The goal is to make future work additive, testable, and isolated from the deterministic risk engine.

## Package

`@casper-sentinel/extensions` contains pure TypeScript interfaces and validation helpers for future adapters. It has no network, payment, scheduler, or tenant database implementation.

## Boundaries

| Capability | Contract | Purpose |
| --- | --- | --- |
| MCP integration | `McpToolAdapter` | Adds external context tools that return observed evidence and risk signals. |
| x402 payments | `PaymentEntitlementProvider` | Gates paid features without touching risk scoring logic. |
| Multi-agent analysis | `AgentOrchestrator` | Runs specialist analyst roles while preserving deterministic decisions. |
| Monitoring jobs | `MonitoringScheduler` | Queues wallet or contract monitoring scopes for later workers. |
| Enterprise RBAC | `Tenant`, `Principal`, `RbacPolicy` | Defines tenant-scoped permissions for future dashboards and APIs. |

## Invariants

- Extensions receive structured inputs and return structured outputs.
- Extensions cannot mutate deterministic decisions directly.
- RBAC checks are tenant-scoped.
- Monitoring schedules must name at least one wallet or contract.
- Secrets are declared in manifests and resolved by infrastructure, never stored in source.

## Future Implementation Path

1. Implement one adapter behind an interface in `packages/extensions` or a dedicated infrastructure package.
2. Add contract tests that use the interface before connecting a live external service.
3. Expose the adapter through application-layer dependency injection.
4. Keep public API and dashboard behavior stable while the extension is disabled.
5. Enable per tenant or per environment only after observability and failure handling exist.
