# Demo Script

This script exercises the MVP path from wallet connection through queued Casper publication state.

## Setup

1. Install dependencies with `corepack pnpm install`.
2. Copy `.env.example` to `.env`.
3. Start the API: `corepack pnpm --filter @casper-sentinel/api dev`.
4. Start the dashboard: `corepack pnpm --filter @casper-sentinel/dashboard dev`.
5. Open `http://localhost:3000`.

## Safe Transfer

1. Keep the default wallet and target.
2. Select `SAFE`.
3. Confirm policy thresholds are `40` and `80`.
4. Click `Analyze`.
5. Verify the decision is `APPROVE`, risk is low, and the report appears in the audit trail.

## Warning Scenario

1. Select `WARNING`.
2. Keep `hash-unknown-contract` as the target.
3. Click `Analyze`.
4. Verify the decision is `WARN` and detector evidence appears under observed and inferred reasoning.

## Blocking Scenario

1. Select `BLOCK`.
2. Keep `hash-blocked-contract` in the denylist policy field.
3. Click `Analyze`.
4. Verify the decision is `BLOCK` and the required user message prevents normal signing.

## Publication Retry

1. Select the newest report in the audit trail.
2. Click `Retry Publication`.
3. Verify the Casper status remains `queued` unless a real worker gateway advances it.
4. Repeat the click and verify the request is idempotent rather than creating a fake transaction hash.

## Acceptance Checks

- The UI remains readable at desktop and mobile widths.
- Empty report history and API failures are visible to the user.
- No screen displays a Casper transaction hash until the report contains one.
- `corepack pnpm verify`, `corepack pnpm build`, and `cargo test` pass before demo.
