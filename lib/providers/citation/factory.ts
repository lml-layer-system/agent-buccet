import type { LawWeb } from "../../engine/types.ts";
import { CompositeCitationProvider } from "./adapters/composite.ts";
import { LocalCitationRegistryProvider } from "./adapters/local-registry.ts";
import type { LegalCitationProvider } from "./types.ts";

export function createCitationProvider(lawWeb: LawWeb): LegalCitationProvider {
  const local = new LocalCitationRegistryProvider({
    knownCitations: lawWeb.knownCitations,
    // Placeholder structure for registry expansion when external adapters are added.
    overruledCitations: [],
    supersededCitations: [],
    adverseAuthorityKnown: lawWeb.knownCitations,
    jurisdictionMap: Object.fromEntries(lawWeb.knownCitations.map((citation) => [citation.toLowerCase(), "binding"] as const)),
  });

  return new CompositeCitationProvider([local]);
}
