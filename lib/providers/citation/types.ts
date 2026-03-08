export type CitationType = "case" | "statute";

export type CitationCandidate = {
  raw: string;
  normalized: string;
  type: CitationType;
};

export type CitationCurrencyStatus = "good" | "overruled" | "superseded" | "unknown";
export type CitationAuthorityLevel = "binding" | "persuasive" | "unknown";

export type CitationExistenceResult = {
  exists: boolean;
  source: string;
};

export type CitationCurrencyResult = {
  status: CitationCurrencyStatus;
  source: string;
};

export type CitationJurisdictionResult = {
  applicable: boolean;
  authorityLevel: CitationAuthorityLevel;
  source: string;
};

export type CitationAdverseResult = {
  adverseAuthorityKnown: boolean;
  source: string;
};

export type CitationVerificationResult = {
  citation: CitationCandidate;
  existence: CitationExistenceResult;
  currency: CitationCurrencyResult;
  jurisdiction: CitationJurisdictionResult;
  adverse: CitationAdverseResult;
};

export interface LegalCitationProvider {
  readonly providerId: string;
  verifyExistence(citation: CitationCandidate): Promise<CitationExistenceResult>;
  verifyCurrency(citation: CitationCandidate): Promise<CitationCurrencyResult>;
  verifyJurisdiction(citation: CitationCandidate, jurisdictionHint?: string): Promise<CitationJurisdictionResult>;
  checkAdverseAuthority(citation: CitationCandidate): Promise<CitationAdverseResult>;
}

