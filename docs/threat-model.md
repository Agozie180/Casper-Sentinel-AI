# Threat Model

Casper Sentinel AI protects users and agent operators before transaction signing. This document captures the MVP threat model used for demo hardening and future security reviews.

## Assets

- User wallet public identity and unsigned transaction intent.
- Risk reports, detector evidence, explanation hashes, and metadata hashes.
- Policy settings including allowlists, denylists, and score thresholds.
- Casper publisher configuration, contract hash, and signer environment.
- Dashboard audit trail and local report store.

## Trust Boundaries

- Browser to API: all request bodies are untrusted and validated with Zod.
- API to AI provider: only sanitized structured evidence may cross this boundary.
- API to report store: reports must preserve deterministic decision data and publication status.
- Worker to Casper gateway: submitted and confirmed states require explicit gateway results.
- Operator environment to signer: private keys must stay outside browser and repository state.

## Primary Threats

| Threat | Risk | MVP Control |
| --- | --- | --- |
| Malformed transaction intent | Incorrect decision or service crash | Strict request schemas and deterministic domain conversion. |
| Policy bypass | Unsafe target approved by weak or missing policy | Policy thresholds, allowlists, denylists, and hard-block detector impact. |
| LLM hallucination | Model invents chain facts or changes decision | Sanitized prompt contract and deterministic decision authority. |
| Duplicate publication request | Multiple deploys for one report | Idempotency key tracking for Casper publication queueing. |
| Fabricated chain success | Dashboard displays fake on-chain proof | `confirmed` only comes from publisher gateway confirmation. |
| Local report tampering | Audit history corrupted | Report hashes, metadata hashes, and future on-chain attestations. |
| Secret exposure | Private key or token leakage | `.env` ignored, no private key fields in dashboard, server-side config only. |
| Unavailable Casper gateway | Demo or publication stalls | Failed/submitted/queued states remain explicit and retryable. |

## Security Invariants

- The AI explanation cannot change `APPROVE`, `WARN`, or `BLOCK`.
- A report cannot be marked `confirmed` without an explicit Casper gateway confirmation.
- Blank transaction hashes are rejected before publication.
- Publication retries with the same idempotency key are safe; competing keys are rejected while queued or submitted.
- The dashboard sends policy overrides as structured data rather than mutating detector logic.

## Phase 7 Residual Risk

The Rust crate currently implements the registry core semantics and tests, while the final Casper Wasm runtime wrapper and funded Testnet deployment remain separate operational work. The current system is honest about this boundary and does not claim a live deploy hash without the gateway returning one.
