import type {
  CitationAdverseResult,
  CitationCandidate,
  CitationCurrencyResult,
  CitationExistenceResult,
  CitationJurisdictionResult,
  LegalCitationProvider,
} from "../types.ts";

export type LocalCitationRegistryData = {
  knownCitations: string[];
  overruledCitations?: string[];
  supersededCitations?: string[];
  adverseAuthorityKnown?: string[];
  jurisdictionMap?: Record<string, "binding" | "persuasive" | "unknown">;
};

export class LocalCitationRegistryProvider implements LegalCitationProvider {
  readonly providerId = "local_citation_registry";

  private readonly known = new Set<string>();
  private readonly overruled = new Set<string>();
  private readonly superseded = new Set<string>();
  private readonly adverse = new Set<string>();
  private readonly jurisdictionMap: Record<string, "binding" | "persuasive" | "unknown">;

  constructor(data: LocalCitationRegistryData) {
    for (const citation of data.knownCitations) {
      this.known.add(norm(citation));
    }
    for (const citation of data.overruledCitations ?? []) {
      this.overruled.add(norm(citation));
    }
    for (const citation of data.supersededCitations ?? []) {
      this.superseded.add(norm(citation));
    }
    for (const citation of data.adverseAuthorityKnown ?? []) {
      this.adverse.add(norm(citation));
    }
    this.jurisdictionMap = data.jurisdictionMap ?? {};
  }

  async verifyExistence(citation: CitationCandidate): Promise<CitationExistenceResult> {
    return {
      exists: this.known.has(norm(citation.normalized)),
      source: this.providerId,
    };
  }

  async verifyCurrency(citation: CitationCandidate): Promise<CitationCurrencyResult> {
    const key = norm(citation.normalized);
    if (this.overruled.has(key)) {
      return { status: "overruled", source: this.providerId };
    }
    if (this.superseded.has(key)) {
      return { status: "superseded", source: this.providerId };
    }
    if (this.known.has(key)) {
      return { status: "good", source: this.providerId };
    }
    return { status: "unknown", source: this.providerId };
  }

  async verifyJurisdiction(citation: CitationCandidate, jurisdictionHint?: string): Promise<CitationJurisdictionResult> {
    const key = norm(citation.normalized);
    const level = this.jurisdictionMap[key] ?? "unknown";

    if (jurisdictionHint && level === "unknown") {
      return {
        applicable: false,
        authorityLevel: "unknown",
        source: this.providerId,
      };
    }

    return {
      applicable: level !== "unknown",
      authorityLevel: level,
      source: this.providerId,
    };
  }

  async checkAdverseAuthority(citation: CitationCandidate): Promise<CitationAdverseResult> {
    return {
      adverseAuthorityKnown: this.adverse.has(norm(citation.normalized)),
      source: this.providerId,
    };
  }
}

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

