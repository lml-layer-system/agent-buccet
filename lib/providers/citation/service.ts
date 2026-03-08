import type { CitationCandidate, CitationVerificationResult, LegalCitationProvider } from "./types.ts";

export type CitationWorkflowSummary = {
  results: CitationVerificationResult[];
  fakeCount: number;
  badCurrencyCount: number;
  jurisdictionFailCount: number;
  missingAdverseCount: number;
  hardStop: boolean;
};

export async function runCitationWorkflow(
  provider: LegalCitationProvider,
  citations: CitationCandidate[],
  jurisdictionHint?: string,
): Promise<CitationWorkflowSummary> {
  const results: CitationVerificationResult[] = [];

  for (const citation of citations) {
    const existence = await provider.verifyExistence(citation);
    const currency = await provider.verifyCurrency(citation);
    const jurisdiction = await provider.verifyJurisdiction(citation, jurisdictionHint);
    const adverse = await provider.checkAdverseAuthority(citation);

    results.push({
      citation,
      existence,
      currency,
      jurisdiction,
      adverse,
    });
  }

  const fakeCount = results.filter((r) => !r.existence.exists).length;
  const badCurrencyCount = results.filter((r) => r.currency.status === "overruled" || r.currency.status === "superseded").length;
  const jurisdictionFailCount = results.filter((r) => !r.jurisdiction.applicable).length;
  const missingAdverseCount = results.filter((r) => !r.adverse.adverseAuthorityKnown).length;

  return {
    results,
    fakeCount,
    badCurrencyCount,
    jurisdictionFailCount,
    missingAdverseCount,
    hardStop: fakeCount > 0,
  };
}

