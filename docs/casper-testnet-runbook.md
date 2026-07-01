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
corepack pnpm --filter @casper-sentinel/casper test
corepack pnpm verify
corepack pnpm build
cargo test
cargo build -p risk-report-registry --target wasm32-unknown-unknown --release
```

The publisher account must be funded on Casper Testnet and authorized by the deployed registry contract policy. Do not put private keys in `.env`; connect a signer through infrastructure that implements `SignedCasperTransactionFactory`.

## Live Submission Sequence

1. Build and test the contract core with `cargo test`.
2. Install the Rust Wasm target with `rustup target add wasm32-unknown-unknown`.
3. Build the local Wasm artifact with `cargo build -p risk-report-registry --target wasm32-unknown-unknown --release`.
4. Fund the deployment account on Casper Testnet. `casper-client 5.0.1` is installed inside Ubuntu WSL in this environment.
5. Run `./scripts/deploy-casper-testnet.ps1 -SecretKeyPath <funded-testnet-secret-key.pem>`.
6. Save the deployed contract hash in `CASPER_RISK_REPORT_CONTRACT_HASH`.
7. Configure a signer implementation that creates a signed Casper transaction for the `record_report` call payload.
8. Instantiate `JsonRpcCasperDeployGateway` with the Testnet RPC URL and signer.
9. Publish a queued report through the worker path.
10. Record `submitted` only after JSON-RPC returns a transaction or deploy hash.
11. Record `confirmed` only after status polling returns execution result data.

## Current Honest Limitations

- The Rust crate currently builds a local Wasm artifact, but a production Casper runtime entry-point review is still required before treating it as deployed contract evidence.
- Native Windows `cargo install casper-client --locked` fails because Casper dependencies use Unix-only APIs. `casper-client 5.0.1` is installed and verified inside Ubuntu WSL, and the PowerShell deployment script falls back to it.
- No private-key signer is included in source. That must be supplied by secure infrastructure or a wallet/signing service.
- This repo does not contain a committed live Testnet transaction hash. When one is produced, it should be added to the demo evidence with the RPC response or explorer link.
- `account_put_transaction` is the default submission method. `legacy-deploy` mode exists for compatibility while the rest of the stack migrates.

## Verification Commands

```bash
corepack pnpm --filter @casper-sentinel/casper test
corepack pnpm verify
corepack pnpm build
cargo test
cargo build -p risk-report-registry --target wasm32-unknown-unknown --release
```

These commands prove the readiness layer is deterministic and typed. They do not prove a live chain write occurred. The deployment script is intentionally separate because it requires a funded key and will use either native `casper-client` or the verified Ubuntu WSL client.
