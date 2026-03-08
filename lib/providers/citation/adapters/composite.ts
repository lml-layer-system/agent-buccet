import type {
  CitationAdverseResult,
  CitationCandidate,
  CitationCurrencyResult,
  CitationExistenceResult,
  CitationJurisdictionResult,
  LegalCitationProvider,
} from "../types.ts";

export class CompositeCitationProvider implements LegalCitationProvider {
  readonly providerId = "composite_citation_provider";

  constructor(private readonly providers: LegalCitationProvider[]) {
    if (providers.length === 0) {
      throw new Error("CompositeCitationProvider requires at least one provider.");
    }
  }

  async verifyExistence(citation: CitationCandidate): Promise<CitationExistenceResult> {
    for (const provider of this.providers) {
      const result = await provider.verifyExistence(citation);
      if (result.exists) {
        return result;
      }
    }
    return { exists: false, source: this.providerId };
  }

  async verifyCurrency(citation: CitationCandidate): Promise<CitationCurrencyResult> {
    for (const provider of this.providers) {
      const result = await provider.verifyCurrency(citation);
      if (result.status !== "unknown") {
        return result;
      }
    }
    return { status: "unknown", source: this.providerId };
  }

  async verifyJurisdiction(citation: CitationCandidate, jurisdictionHint?: string): Promise<CitationJurisdictionResult> {
    for (const provider of this.providers) {
      const result = await provider.verifyJurisdiction(citation, jurisdictionHint);
      if (result.applicable) {
        return result;
      }
    }
    return { applicable: false, authorityLevel: "unknown", source: this.providerId };
  }

  async checkAdverseAuthority(citation: CitationCandidate): Promise<CitationAdverseResult> {
    for (const provider of this.providers) {
      const result = await provider.checkAdverseAuthority(citation);
      if (result.adverseAuthorityKnown) {
        return result;
      }
    }
    return { adverseAuthorityKnown: false, source: this.providerId };
  }
}

