import { describe, expect, it } from "vitest";
import {
  assertUniqueExtensionIds,
  assertValidMonitoringSchedule,
  createExtensionManifest,
  isPermissionAllowed,
  type ExtensionManifest,
  type Principal,
  type RbacPolicy,
} from "./index.js";

const manifest: ExtensionManifest = {
  id: "mcp-contract-context",
  kind: "mcp",
  status: "planned",
  owner: "platform",
  description: "Contract context adapter boundary.",
  requiredSecrets: ["MCP_SERVER_URL"],
  permissions: ["intent:read", "contract-context:read"],
};

describe("extension contracts", () => {
  it("accepts well-formed manifests", () => {
    expect(createExtensionManifest(manifest)).toEqual(manifest);
  });

  it("rejects duplicate manifest ids", () => {
    expect(() => assertUniqueExtensionIds([manifest, { ...manifest }])).toThrow("Duplicate extension id");
  });

  it("rejects duplicate permissions inside one manifest", () => {
    expect(() =>
      createExtensionManifest({
        ...manifest,
        permissions: ["intent:read", "intent:read"],
      }),
    ).toThrow("Duplicate permission");
  });

  it("evaluates tenant RBAC grants without crossing tenant boundaries", () => {
    const principal: Principal = { id: "user-1", tenantId: "tenant-1", roles: ["analyst"] };
    const policy: RbacPolicy = {
      tenantId: "tenant-1",
      grants: {
        owner: ["tenant:admin"],
        admin: ["policy:write"],
        analyst: ["report:read", "intent:read"],
        viewer: ["report:read"],
      },
    };

    expect(isPermissionAllowed(principal, policy, "intent:read")).toBe(true);
    expect(isPermissionAllowed(principal, policy, "policy:write")).toBe(false);
    expect(isPermissionAllowed({ ...principal, tenantId: "tenant-2" }, policy, "intent:read")).toBe(false);
  });

  it("validates monitoring schedules before a scheduler implementation runs", () => {
    expect(() =>
      assertValidMonitoringSchedule({
        id: "daily-wallet-monitor",
        cadence: "daily",
        startsAt: "2026-07-01T00:00:00.000Z",
        scope: {
          tenantId: "tenant-1",
          walletAddresses: ["account-hash-sender"],
          contractHashes: [],
          policyVersion: "dashboard-mvp-policy",
        },
      }),
    ).not.toThrow();
  });

  it("rejects empty monitoring scopes", () => {
    expect(() =>
      assertValidMonitoringSchedule({
        id: "empty-monitor",
        cadence: "daily",
        startsAt: "2026-07-01T00:00:00.000Z",
        scope: {
          tenantId: "tenant-1",
          walletAddresses: [],
          contractHashes: [],
          policyVersion: "dashboard-mvp-policy",
        },
      }),
    ).toThrow("Monitoring scope must include at least one wallet or contract.");
  });
});
