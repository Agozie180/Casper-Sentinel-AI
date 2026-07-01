# Casper Testnet Publication Runbook

Phase 9 adds the live-chain readiness layer for publishing Sentinel risk report attestations to Casper Testnet. It does not claim a live transaction has happened. A report is only `submitted` or `confirmed` after the configured gateway receives a real JSON-RPC hash and confirmation response.

## What Exists Now

- `@casper-sentinel/casper` builds the `record_report` call payload for the risk report registry contract.
- `JsonRpcCasperDeployGateway` can submit an already-signed Casper transaction through `account_put_transaction`.
- The same gateway can use legacy deploy JSON-RPC with `mode: "legacy-deploy"` for environments that still require `account_put_deploy`.
- Confirmation polling is explicit. The gateway returns `confirmed: true` only when a status response contains execution result data.
- Signing is intentionally injected through `SignedCasperTransactionFactory`; this package does not hold private keys, seed phrases, or wallet secrets.
- `assertCasperLiveReadiness` validates the required runtime fields before any live publication attempt.

## Required Environment

```bash
CASPER_NETWORK=testnet
CASPER_RPC_URL=https://node.testnet.casper.network/rpc
CASPER_SSE_URL=https://node.testnet.casper.network/events/main
CASPER_RISK_REPORT_CONTRACT_HASH=<deployed risk-report-registry contract hash>
CASPER_PUBLISHER_PUBLIC_KEY=<funded publisher account public key>
```

The publisher account must be funded on Casper Testnet and authorized by the deployed registry contract policy. Do not put private keys in `.env`; connect a signer through infrastructure that implements `SignedCasperTransactionFactory`.

## Live Submission Sequence

1. Build and test the contract core with `cargo test`.
2. Compile and deploy the final Wasm runtime wrapper once contract runtime bindings are implemented.
3. Save the deployed contract hash in `CASPER_RISK_REPORT_CONTRACT_HASH`.
4. Configure a signer implementation that creates a signed Casper transaction for the `record_report` call payload.
5. Instantiate `JsonRpcCasperDeployGateway` with the Testnet RPC URL and signer.
6. Publish a queued report through the worker path.
7. Record `submitted` only after JSON-RPC returns a transaction or deploy hash.
8. Record `confirmed` only after status polling returns execution result data.

## Current Honest Limitations

- The Rust crate currently models and tests registry behavior, but a production Casper Wasm entry-point wrapper is still required before contract deployment.
- No private-key signer is included in source. That must be supplied by secure infrastructure or a wallet/signing service.
- This repo does not contain a committed live Testnet transaction hash. When one is produced, it should be added to the demo evidence with the RPC response or explorer link.
- `account_put_transaction` is the default submission method. `legacy-deploy` mode exists for compatibility while the rest of the stack migrates.

## Verification Commands

```bash
corepack pnpm --filter @casper-sentinel/casper test
corepack pnpm verify
corepack pnpm build
cargo test
```

These commands prove the readiness layer is deterministic and typed. They do not prove a live chain write occurred.
