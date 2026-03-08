import { loadLawWeb } from "../lib/engine/store.ts";
import { clearLedger, runDemoEvaluation } from "../lib/engine/runtime.ts";

async function main() {
  const lawWeb = await loadLawWeb();

  const input = {
    content:
      "Plaintiff requests analysis of this agreement language only, no external sources, for admissible legal risk summary under demo constraints.",
    fileName: "demo.txt",
  };

  clearLedger();

  const first = runDemoEvaluation(input, lawWeb);
  clearLedger();
  const second = runDemoEvaluation(input, lawWeb);

  const firstComparable = {
    outcome: first.outcome,
    gates: first.gates,
    repairPlan: first.repairPlan,
  };

  const secondComparable = {
    outcome: second.outcome,
    gates: second.gates,
    repairPlan: second.repairPlan,
  };

  const a = JSON.stringify(firstComparable);
  const b = JSON.stringify(secondComparable);

  if (a !== b) {
    console.error("Determinism check failed.");
    process.exit(1);
  }

  console.log("Determinism check passed: same input + same law web => same witness, repair, outcome.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
