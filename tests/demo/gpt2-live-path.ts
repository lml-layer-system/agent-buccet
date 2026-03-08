import { loadLawWeb } from "../../lib/engine/store.ts";
import { runDemoEvaluation } from "../../lib/engine/runtime.ts";
import { runGpt2Constrained } from "../../lib/demo/gpt2.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const lawWeb = await loadLawWeb();

  const inputA = "Review this contract clause for admissibility and legal style constraints.";
  const inputB = "Review this complaint draft with citation and jurisdiction constraints.";

  const witnessA = runDemoEvaluation({ content: inputA, fileName: "a.txt" }, lawWeb);
  const witnessB = runDemoEvaluation({ content: inputB, fileName: "b.txt" }, lawWeb);

  const outA = await runGpt2Constrained({ runId: witnessA.runId, content: inputA, witness: witnessA });
  const outB = await runGpt2Constrained({ runId: witnessB.runId, content: inputB, witness: witnessB });

  assert(outA.receipt.callId !== outB.receipt.callId, "Model call receipt IDs must be unique per run.");
  assert(outA.receipt.inputDigest !== outB.receipt.inputDigest, "Input digest must reflect live input.");
  assert(outA.text !== outB.text, "Live path check failed: outputs should not be static canned text.");

  console.log("Demo GPT-2 live path verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

