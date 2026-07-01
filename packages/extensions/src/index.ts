import type { DecisionAction, RiskSignal, TransactionIntent } from "@casper-sentinel/domain";

export type ExtensionKind = "mcp" | "x402" | "agent" | "monitoring" | "tenant-rbac";
export type ExtensionStatus = "planned" | "disabled" | "enabled";

export interface ExtensionManifest {
  readonly id: string;
  readonly kind: ExtensionKind;
  readonly status: ExtensionStatus;
  readonly owner: "platform" | "tenant" | "operator";
  readonly description: string;
  readonly requiredSecrets: readonly string[];
  readonly permissions: readonly ExtensionPermission[];
}

export type ExtensionPermission =
  | "intent:read"
  | "report:read"
  | "report:write"
  | "policy:read"
  | "policy:write"
  | "wallet-context:read"
  | "contract-context:read"
  | "payment:verify"
  | "monitor:write"
  | "tenant:admin";

export interface McpToolRequest {
  readonly toolName: string;
  readonly intent: TransactionIntent;
  readonly traceId: string;
  readonly input: Readonly<Record<string, unknown>>;
}

export interface McpToolResult {
  readonly toolName: string;
  readonly observed: readonly string[];
  readonly signals: readonly RiskSignal[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface McpToolAdapter {
  readonly manifest: ExtensionManifest;
  invoke(request: McpToolRequest): Promise<McpToolResult>;
}

export interface PaymentEntitlementRequest {
  readonly walletAddress: string;
  readonly tenantId: string;
  readonly feature: "analysis" | "monitoring" | "api" | "enterprise-policy";
  readonly amountAtomic: string;
  readonly currency: "x402" | "CSPR" | "USD";
}

export interface PaymentEntitlement {
  readonly granted: boolean;
  readonly receiptId?: string;
  readonly expiresAt?: string;
  readonly reason?: string;
}

export interface PaymentEntitlementProvider {
  readonly manifest: ExtensionManifest;
  verify(request: PaymentEntitlementRequest): Promise<PaymentEntitlement>;
}

export type AgentRole = "contract-analyst" | "wallet-analyst" | "policy-analyst" | "incident-summarizer";

export interface AgentTask {
  readonly id: string;
  readonly role: AgentRole;
  readonly intent: TransactionIntent;
  readonly evidence: readonly RiskSignal[];
  readonly deadlineMs: number;
}

export interface AgentFinding {
  readonly agentRole: AgentRole;
  readonly observedEvidence: readonly string[];
  readonly inferredRisk: readonly string[];
  readonly confidence: number;
}

export interface AgentDecisionEnvelope {
  readonly deterministicDecision: DecisionAction;
  readonly findings: readonly AgentFinding[];
  readonly recommendation: string;
}

export interface AgentOrchestrator {
  readonly manifest: ExtensionManifest;
  run(tasks: readonly AgentTask[]): Promise<AgentDecisionEnvelope>;
}

export type MonitoringCadence = "hourly" | "daily" | "weekly";

export interface MonitoringScope {
  readonly tenantId: string;
  readonly walletAddresses: readonly string[];
  readonly contractHashes: readonly string[];
  readonly policyVersion: string;
}

export interface MonitoringSchedule {
  readonly id: string;
  readonly cadence: MonitoringCadence;
  readonly startsAt: string;
  readonly scope: MonitoringScope;
}

export interface MonitoringJob {
  readonly id: string;
  readonly scheduleId: string;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly createdAt: string;
}

export interface MonitoringScheduler {
  readonly manifest: ExtensionManifest;
  enqueue(schedule: MonitoringSchedule): Promise<MonitoringJob>;
}

export type TenantRole = "owner" | "admin" | "analyst" | "viewer";

export interface Tenant {
  readonly id: string;
  readonly displayName: string;
  readonly policyVersion: string;
}

export interface Principal {
  readonly id: string;
  readonly tenantId: string;
  readonly roles: readonly TenantRole[];
}

export interface RbacPolicy {
  readonly tenantId: string;
  readonly grants: Readonly<Record<TenantRole, readonly ExtensionPermission[]>>;
}

export function createExtensionManifest(input: ExtensionManifest): ExtensionManifest {
  assertNonEmpty(input.id, "Extension id");
  assertNonEmpty(input.description, "Extension description");
  assertUniqueStrings(input.requiredSecrets, "required secret");
  assertUniqueStrings(input.permissions, "permission");
  return input;
}

export function assertUniqueExtensionIds(manifests: readonly ExtensionManifest[]): void {
  assertUniqueStrings(manifests.map((manifest) => manifest.id), "extension id");
}

export function isPermissionAllowed(
  principal: Principal,
  policy: RbacPolicy,
  permission: ExtensionPermission,
): boolean {
  if (principal.tenantId !== policy.tenantId) return false;
  return principal.roles.some((role) => policy.grants[role]?.includes(permission) ?? false);
}

export function assertValidMonitoringSchedule(schedule: MonitoringSchedule): void {
  assertNonEmpty(schedule.id, "Monitoring schedule id");
  if (Number.isNaN(Date.parse(schedule.startsAt))) {
    throw new Error("Monitoring schedule start time must be an ISO date string.");
  }
  if (schedule.scope.walletAddresses.length === 0 && schedule.scope.contractHashes.length === 0) {
    throw new Error("Monitoring scope must include at least one wallet or contract.");
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} is required.`);
}

function assertUniqueStrings(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    assertNonEmpty(value, label);
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}.`);
    seen.add(value);
  }
}
