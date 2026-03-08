import { LocalCitationRegistryProvider } from "../../lib/providers/citation/adapters/local-registry.ts";
import { runCitationWorkflow } from "../../lib/providers/citation/service.ts";
import type { CitationCandidate } from "../../lib/providers/citation/types.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const known = ["Smith v. Jones, 123 F.3d 456", "NRS 123.010"];

  const provider = new LocalCitationRegistryProvider({
    knownCitations: known,
    overruledCitations: [known[0]],
    supersededCitations: [known[1]],
    adverseAuthorityKnown: [],
    jurisdictionMap: {
      [known[0].toLowerCase()]: "unknown",
      [known[1].toLowerCase()]: "unknown",
    },
  });

  const fakeCitation: CitationCandidate = {
    raw: "Fake v. Madeup, 999 U.S. 999",
    normalized: "Fake v. Madeup, 999 U.S. 999",
    type: "case",
  };

  const staleCitation: CitationCandidate = {
    raw: known[0],
    normalized: known[0],
    type: "case",
  };

  const wrongJurisdictionCitation: CitationCandidate = {
    raw: known[1],
    normalized: known[1],
    type: "statute",
  };

  const workflow = await runCitationWorkflow(
    provider,
    [fakeCitation, staleCitation, wrongJurisdictionCitation],
    "NV",
  );

  assert(workflow.fakeCount > 0, "Expected fake citation detection to trigger fail-closed behavior.");
  assert(workflow.badCurrencyCount > 0, "Expected stale/overruled citation detection to trigger fail-closed behavior.");
  assert(workflow.jurisdictionFailCount > 0, "Expected wrong jurisdiction detection to trigger fail-closed behavior.");
  assert(workflow.missingAdverseCount > 0, "Expected missing adverse authority detection to trigger fail-closed behavior.");
  assert(workflow.hardStop, "Expected hard stop when fake citation is present.");

  console.log("Sanction-risk suite passed.");
  console.log(
    JSON.stringify(
      {
        fakeCount: workflow.fakeCount,
        badCurrencyCount: workflow.badCurrencyCount,
        jurisdictionFailCount: workflow.jurisdictionFailCount,
        missingAdverseCount: workflow.missingAdverseCount,
        hardStop: workflow.hardStop,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
