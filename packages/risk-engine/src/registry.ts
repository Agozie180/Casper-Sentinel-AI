import type { Detector, DetectorRegistry } from "./types.js";
import { approvalScopeDetector } from "./detectors/approval-scope-detector.js";
import { malformedArgsDetector } from "./detectors/malformed-args-detector.js";
import { metadataDetector } from "./detectors/metadata-detector.js";
import { policyListDetector } from "./detectors/policy-list-detector.js";
import { targetDetector } from "./detectors/target-detector.js";
import { valueDetector } from "./detectors/value-detector.js";

/** Creates a registry over a stable detector list. */
export function createDetectorRegistry(detectors: readonly Detector[]): DetectorRegistry {
  const byId = new Map(detectors.map((detector) => [detector.id, detector]));
  return {
    detectors,
    get(id: string): Detector | undefined {
      return byId.get(id);
    },
  };
}

/** Returns the MVP detector set used for deterministic local transaction analysis. */
export function createMvpDetectorRegistry(): DetectorRegistry {
  return createDetectorRegistry([
    malformedArgsDetector,
    policyListDetector,
    valueDetector,
    targetDetector,
    approvalScopeDetector,
    metadataDetector,
  ]);
}
