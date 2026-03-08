import { loadCanonicalPlanetManifestStrict } from "../planet/manifest.ts";
import { loadLawWeb } from "./store.ts";

const MIN_CANONICAL_TOTAL_LAWS = 232;
let cachedReady = false;

export async function assertApiLawReadiness(): Promise<void> {
  if (cachedReady) {
    return;
  }

  const canonical = await loadCanonicalPlanetManifestStrict();
  if (canonical.total_laws < MIN_CANONICAL_TOTAL_LAWS) {
    throw new Error(
      `Canonical planet manifest incomplete for API startup: expected at least ${MIN_CANONICAL_TOTAL_LAWS} laws, got ${canonical.total_laws}.`,
    );
  }

  const lawWeb = await loadLawWeb();
  if (!lawWeb.coverage?.complete) {
    throw new Error("Compiled law web coverage is incomplete. API startup blocked.");
  }

  const incorporated = new Set(
    [...lawWeb.floor, ...lawWeb.state, ...lawWeb.meta]
      .map((law) => law.sourceLawId)
      .filter((value): value is string => Boolean(value)),
  );
  const missingCanonicalLawIds = canonical.laws
    .map((law) => `CLAW-${String(law.law_id).padStart(4, "0")}`)
    .filter((id) => !incorporated.has(id));

  if (missingCanonicalLawIds.length > 0) {
    throw new Error(
      `Canonical planet manifest not fully incorporated into compiled law web. Missing=${missingCanonicalLawIds.length}.`,
    );
  }

  cachedReady = true;
}

export function clearApiLawReadinessCache(): void {
  cachedReady = false;
}
