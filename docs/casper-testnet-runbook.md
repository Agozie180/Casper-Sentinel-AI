# Casper Testnet Publication Runbook

Phase 9 adds the live-chain layer for publishing Sentinel risk report attestations to Casper Testnet. The risk report registry is now deployed on Casper Testnet; reports should only be marked `submitted` or `confirmed` after the configured gateway receives real JSON-RPC deploy evidence.

## What Exists Now

- `@casper-sentinel/casper` builds the `record_report` call payload for the risk report registry contract.
- `JsonRpcCasperDeployGateway` can submit an already-signed Casper transaction through `account_put_transaction`.
- The same gateway can use legacy deploy JSON-RPC with `mode: "legacy-deploy"` for environments that still require `account_put_deploy`.
- Confirmation polling is explicit. The gateway returns `confirmed: true` only when a status response contains execution result data.
- Signing is intentionally injected through `SignedCasperTransactionFactory`; this package does not hold private keys, seed phrases, or wallet secrets.
- `assertCasperLiveReadiness` validates the required runtime fields before any live publication attempt.
- The Rust contract crate now includes Casper entry points for installing and calling the registry on-chain.

## Live Testnet Deployment

- Network: Casper Testnet, `casper-test`
- Account public key: `0202f44ecf8e3d2dabf6b8f29625a7584994a76586b9b08b4bbe4df294fbaac2956b`
- Successful deploy hash: `0a4dc7c4d7cc7ac042b014ed9be206b83fc2f5f8cbc2a09a336f8ecea04a90e7`
- Contract hash: `contract-f8843bf75c839024172e7288b56c1966d30d959132fc2c73120e633046a0eda0`
- Contract package hash: `contract-package-75631e7e6ab6b546551aca4b69b5f7cd19901f8b6abc5c94ac4f7dc48aa22b50`
- Contract Wasm hash: `contract-wasm-769de8d7ceb6fd5230aea34f75b38a793d5eb0cd005621eb91e73aa28256c184`
- Account named key: `casper_sentinel_risk_report_registry`
- Payment limit used for the successful deploy: `200000000000` motes
- Gas consumed by the successful deploy: `65576079361` motes

Use the contract hash for `CASPER_RISK_REPORT_CONTRACT_HASH` unless the calling integration explicitly asks for the package hash.

## Required Environment

```bash
corepack pnpm --filter @casper-sentinel/casper test
corepack pnpm verify
corepack pnpm build
cargo test
rustup target add wasm32v1-none
RUSTC_BOOTSTRAP=1 RUSTFLAGS="-C link-arg=--allow-undefined" cargo build -p risk-report-registry --target wasm32v1-none --release
```

The publisher account must be funded on Casper Testnet and authorized by the deployed registry contract policy. Do not put private keys in `.env`; connect a signer through infrastructure that implements `SignedCasperTransactionFactory`.

## Live Submission Sequence

1. Build and test the contract core with `cargo test`.
2. Install the Rust Wasm target with `rustup target add wasm32v1-none`.
3. Build the local Wasm artifact with `RUSTC_BOOTSTRAP=1 RUSTFLAGS="-C link-arg=--allow-undefined" cargo build -p risk-report-registry --target wasm32v1-none --release`.
4. Fund the deployment account on Casper Testnet. `casper-client 5.0.1` is installed inside Ubuntu WSL in this environment.
5. Run `./scripts/deploy-casper-testnet.ps1 -SecretKeyPath <funded-testnet-secret-key.pem> -PaymentAmount 200000000000`.
6. Save the deployed contract hash in `CASPER_RISK_REPORT_CONTRACT_HASH`.
7. Configure a signer implementation that creates a signed Casper transaction for the `record_report` call payload.
8. Instantiate `JsonRpcCasperDeployGateway` with the Testnet RPC URL and signer.
9. Publish a queued report through the worker path.
10. Record `submitted` only after JSON-RPC returns a transaction or deploy hash.
11. Record `confirmed` only after status polling returns execution result data.

## Contract Entry Points

- `record_report(report_id, wallet_address, transaction_hash, timestamp, risk_score, decision, explanation_hash, metadata_hash)` stores a compact risk attestation.
- `get_report(report_id)` returns the stored compact attestation string for one report.
- `get_reports_by_wallet(wallet_address)` returns the comma-separated report ids indexed for a wallet.

## Current Honest Limitations

- No private-key signer is included in source. That must be supplied by secure infrastructure or a wallet/signing service.
- `account_put_transaction` is the default submission method. `legacy-deploy` mode exists for compatibility while the rest of the stack migrates.
- Native Windows `cargo install casper-client --locked` fails because Casper dependencies use Unix-only APIs. `casper-client 5.0.1` is installed and verified inside Ubuntu WSL, and the PowerShell deployment script falls back to it.
- The successful deploy used `wasm32v1-none`. `wasm32-unknown-unknown` artifacts were rejected by Casper Testnet because they included unsupported bulk memory operations.

## Verification Commands

```bash
corepack pnpm --filter @casper-sentinel/casper test
corepack pnpm verify
corepack pnpm build
cargo test
RUSTC_BOOTSTRAP=1 RUSTFLAGS="-C link-arg=--allow-undefined" cargo build -p risk-report-registry --target wasm32v1-none --release
```

These commands prove the readiness layer is deterministic and typed. The live deploy hash above proves the registry install transaction executed successfully on Casper Testnet.
