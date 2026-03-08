import { getProfileOrThrow, type RunMode } from "../../profiles/index.ts";
import type { SnapIntegrationOptions } from "../types.ts";

export type SnapProfileAdapter = {
  profileId: string;
  runMode: RunMode;
  integration: SnapIntegrationOptions;
};

export function buildProfileAdapter(
  profileId: string,
  runMode: RunMode,
  artifactRef: string,
  providedProofLawIds: string[] = [],
): SnapProfileAdapter {
  const profile = getProfileOrThrow(profileId);

  return {
    profileId,
    runMode,
    integration: {
      artifactRef,
      profileId: profile.profileId,
      profileVersion: profile.version,
      runMode,
      strictNoProofNoTransition: runMode === "product",
      providedProofLawIds,
      authorizedRepairPacks: ["NSL.REPAIR_PACK.ALL"],
      measurementPackAuthorized: true,
      allowVersionRef: true,
    },
  };
}
