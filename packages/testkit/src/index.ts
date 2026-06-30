import {
  TransactionKind,
  createSecurityPolicy,
  type SecurityPolicy,
  type TransactionIntent,
} from "@casper-sentinel/domain";

export const trustedContract = "hash-trusted-contract";
export const unknownContract = "hash-unknown-contract";
export const blockedContract = "hash-blocked-contract";
export const blockedWallet = "account-hash-blocked";

/** Builds a deterministic MVP policy fixture with one trusted and one blocked contract. */
export function buildMvpPolicy(overrides: Partial<SecurityPolicy> = {}): SecurityPolicy {
  return createSecurityPolicy({
    version: "test-mvp-policy",
    highValueMotes: "100000000000",
    blockValueMotes: "1000000000000",
    maxApprovalMotes: "500000000000",
    allowlistedTargets: [trustedContract],
    denylistedTargets: [blockedContract],
    denylistedWallets: [blockedWallet],
    knownContracts: {
      [trustedContract]: {
        name: "Trusted Vault",
        verified: true,
        allowedEntryPoints: ["deposit", "transfer"],
      },
    },
    ...overrides,
  });
}

/** Builds a safe transfer intent fixture for tests that do not require live chain data. */
export function buildSafeTransferIntent(
  overrides: Partial<TransactionIntent> = {},
): TransactionIntent {
  return {
    walletAddress: "account-hash-sender",
    chainName: "casper-testnet",
    transactionKind: TransactionKind.Transfer,
    target: trustedContract,
    amountMotes: "2500000000",
    args: {},
    clientContext: {},
    ...overrides,
  };
}

/** Builds a warning-level contract call fixture against an unknown target. */
export function buildWarningContractCallIntent(
  overrides: Partial<TransactionIntent> = {},
): TransactionIntent {
  return buildSafeTransferIntent({
    transactionKind: TransactionKind.ContractCall,
    target: unknownContract,
    entryPoint: "execute",
    amountMotes: "150000000000",
    args: { recipient: "account-hash-recipient" },
    ...overrides,
  });
}

/** Builds a blocking approval fixture with an unsafe target and unlimited approval. */
export function buildBlockingApprovalIntent(
  overrides: Partial<TransactionIntent> = {},
): TransactionIntent {
  return buildSafeTransferIntent({
    transactionKind: TransactionKind.Approval,
    target: blockedContract,
    entryPoint: "approve",
    approvalScope: {
      spender: blockedContract,
      unlimited: true,
    },
    args: { spender: blockedContract, amount: "unlimited" },
    ...overrides,
  });
}
