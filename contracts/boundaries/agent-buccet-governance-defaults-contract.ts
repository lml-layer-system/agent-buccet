import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  DEFAULT_ADMISSION_CONFIG,
  DEFAULT_GOVERNOR_CONFIG,
  createPersistentBoundaryRuntimeStore,
  initialAdmissionState,
  initialGovernorState,
  restoreBoundaryRuntimeStore,
} from "./../../src/index.ts";

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-governance-defaults-"));

  try {
    const sessionId = `agent-buccet-governance-defaults-${Date.now()}`;
    const actorId = "user:governance-defaults-contract";

    const store = await createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
      sessionsDir: tempRoot,
    });

    const initialConfig = store.getConfig();
    assert.deepEqual(
      initialConfig.governorConfig,
      DEFAULT_GOVERNOR_CONFIG,
      "persistent runtime must seed default outbound governor config",
    );
    assert.deepEqual(
      initialConfig.governorState,
      initialGovernorState(),
      "persistent runtime must seed empty outbound governor state",
    );
    assert.deepEqual(
      initialConfig.admissionConfig,
      DEFAULT_ADMISSION_CONFIG,
      "persistent runtime must seed default inbound admission config",
    );
    assert.deepEqual(
      initialConfig.admissionState,
      initialAdmissionState(),
      "persistent runtime must seed empty inbound admission state",
    );

    const customGovernorConfig = {
      velocity: { maxRpm: 77, windowMs: 90_000 },
      mass: { maxCrossings: 321 },
    };
    const customGovernorState = {
      crossingTimestamps: [1_000, 2_000],
      totalWeightedCrossings: 17,
      recentDecisions: [true, false, true],
    };
    const customAdmissionConfig = {
      velocity: { maxRpm: 31, windowMs: 45_000 },
      density: { maxDenyRatio: 0.5, windowSize: 7 },
      mass: { maxInboundWeight: 99, windowMs: 45_000 },
    };
    const customAdmissionState = {
      canyonProvenances: {
        "ip:blocked": {
          canyonedAt: 123,
          reason: "contract canyon",
          ledgered: true,
          promotionKind: "hard_ceiling" as const,
          operatorDisposition: "deny_as_law" as const,
        },
      },
      allowOnceProvenances: {},
      denyOnceProvenances: {},
      allowedProvenances: {},
      provenanceRecords: {
        "ip:blocked": {
          requestTimestamps: [100, 110, 120],
          recentDecisions: [false, false, false],
          totalInboundWeight: 12,
          windowWeightTimestamps: [
            { ts: 100, weight: 4 },
            { ts: 110, weight: 4 },
            { ts: 120, weight: 4 },
          ],
          lastSeenMs: 120,
          totalDeniedCount: 3,
        },
      },
      hostileDeniedCounts: {
        "ip:blocked": 3,
      },
    };

    store.replaceConfig({
      ...initialConfig,
      governorConfig: customGovernorConfig,
      governorState: customGovernorState,
      admissionConfig: customAdmissionConfig,
      admissionState: customAdmissionState,
    });
    await store.persist();

    const restored = await restoreBoundaryRuntimeStore({
      sessionId,
      sessionsDir: tempRoot,
    });
    assert.ok(restored, "restored runtime store must exist");

    const restoredConfig = restored.getConfig();
    assert.deepEqual(
      restoredConfig.governorConfig,
      customGovernorConfig,
      "restored runtime must preserve outbound governor config",
    );
    assert.deepEqual(
      restoredConfig.governorState,
      customGovernorState,
      "restored runtime must preserve outbound governor state",
    );
    assert.deepEqual(
      restoredConfig.admissionConfig,
      customAdmissionConfig,
      "restored runtime must preserve inbound admission config",
    );
    assert.deepEqual(
      restoredConfig.admissionState,
      customAdmissionState,
      "restored runtime must preserve inbound admission state",
    );

    console.log("Agent Buccet governance defaults contract");
    console.log("  default outbound governor seeded:  ok");
    console.log("  default inbound admission seeded:  ok");
    console.log("  runtime governance survives restore: ok");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
