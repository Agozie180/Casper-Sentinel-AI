import { z } from "zod";
import { TransactionKind } from "@casper-sentinel/domain";

const transactionKindSchema = z.enum([
  TransactionKind.Transfer,
  TransactionKind.ContractCall,
  TransactionKind.Approval,
  TransactionKind.Unknown,
]);

const approvalScopeSchema = z
  .object({
    spender: z.string().min(1),
    allowanceMotes: z.string().min(1).optional(),
    unlimited: z.boolean().optional(),
  })
  .strict();

const contractMetadataSchema = z
  .object({
    name: z.string().min(1).optional(),
    verified: z.boolean(),
    allowedEntryPoints: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const securityPolicyOverridesSchema = z
  .object({
    version: z.string().min(1).optional(),
    warnScore: z.number().int().min(0).max(100).optional(),
    blockScore: z.number().int().min(0).max(100).optional(),
    highValueMotes: z.string().min(1).optional(),
    blockValueMotes: z.string().min(1).optional(),
    maxApprovalMotes: z.string().min(1).optional(),
    allowlistedTargets: z.array(z.string().min(1)).optional(),
    denylistedTargets: z.array(z.string().min(1)).optional(),
    denylistedWallets: z.array(z.string().min(1)).optional(),
    knownContracts: z.record(z.string(), contractMetadataSchema).optional(),
  })
  .strict();

export const transactionIntentSchema = z
  .object({
    walletAddress: z.string().min(1),
    chainName: z.enum(["casper-testnet", "casper-mainnet", "unknown"]),
    transactionKind: transactionKindSchema,
    target: z.string().min(1),
    entryPoint: z.string().min(1).optional(),
    amountMotes: z.string().min(1).optional(),
    approvalScope: approvalScopeSchema.optional(),
    args: z.record(z.string(), z.unknown()),
    rawTransaction: z.unknown().optional(),
    clientContext: z.record(z.string(), z.unknown()),
  })
  .strict();

export const analyzeRequestSchema = z
  .object({
    intent: transactionIntentSchema,
    policy: securityPolicyOverridesSchema.optional(),
  })
  .strict();

export type AnalyzeRequestBody = z.infer<typeof analyzeRequestSchema>;
