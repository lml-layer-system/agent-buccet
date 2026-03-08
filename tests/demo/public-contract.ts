import { loadLawWeb } from "../../lib/engine/store.ts";
import { runDemoEvaluation } from "../../lib/engine/runtime.ts";
import { runGpt2Constrained } from "../../lib/demo/gpt2.ts";
import { buildPublicDemoResponse } from "../../lib/demo/contract.ts";

const BANNED = [/\bnull\b/i, /\bnsl\b/i, /\buic\b/i, /\buuis\b/i, /\blaw-\d+/i, /\bpx-/i];

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const lawWeb = await loadLawWeb();
  const witness = runDemoEvaluation(
    {
      content: "Plaintiff requests contract review with jurisdiction and citation references for admissible legal summary.",
      fileName: "demo.txt",
    },
    lawWeb,
  );
  const gpt2 = await runGpt2Constrained({
    runId: witness.runId,
    content: "Plaintiff requests contract review with jurisdiction and citation references for admissible legal summary.",
    witness,
  });
  const payload = buildPublicDemoResponse(witness, gpt2);
  const serialized = JSON.stringify(payload);

  for (const pattern of BANNED) {
    assert(!pattern.test(serialized), `Public contract leak detected (${pattern}).`);
  }

  assert(payload.lmlStages.length === 5, "Public contract requires 5 LML stages.");
  assert(payload.modelReceipt.provider === "gpt2-runtime", "Model receipt provider mismatch.");
  assert(payload.modelReceipt.model === "gpt2", "Model receipt model mismatch.");

  console.log("Demo public contract verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

