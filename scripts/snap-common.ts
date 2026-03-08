import { runUIC } from "../lib/snap/uic.ts";
import { runUUIS } from "../lib/snap/uuis.ts";
import { runSnapToEngine } from "../lib/snap/lml-integration.ts";
import { buildProfileAdapter } from "../lib/snap/profiles/index.ts";
import { getProfileOrThrow, listProfiles, type RunMode } from "../lib/profiles/index.ts";

export const CANONICAL_ARTIFACT = `
System state must remain admissible.
The engine must not allow illegal transitions and must enforce a forbidden boundary.
Module kernel, service stack, and ledger component are coupled by explicit dependency paths.
Detector metric monitors thresholds and classifies violations.
If violation occurs, apply repair: rollback, restore, recheck, and quarantine.
Meta policy requires authorization, approval gate, and audit ledger proof.
Containment firebreak isolates cascade risk and blocks spread across modules.
`;

export function runSnap(profileId: string, runMode: RunMode = "demo") {
  const profile = getProfileOrThrow(profileId);
  const per = runUIC(CANONICAL_ARTIFACT, profile, runMode);
  const uuis = runUUIS(per, profile);
  const adapter = buildProfileAdapter(profileId, runMode, `${profileId}:${runMode}`, []);
  const snap = runSnapToEngine(per, uuis, adapter.integration);
  return { profile, per, uuis, snap };
}

export function runAllProfiles(runMode: RunMode = "demo") {
  return listProfiles().map((profile) => runSnap(profile.profileId, runMode));
}
