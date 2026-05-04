import assert from "node:assert/strict";
import {
  renderBuccetFullSystemBodyMarkdown,
  runBuccetFullSystemBody,
} from "./../../src/runtime/full-system-body.ts";

async function main() {
  const process = runBuccetFullSystemBody();
  const markdown = renderBuccetFullSystemBodyMarkdown();

  assert.equal(
    process.concept,
    "public-safe Agent Buccet runtime surface summary",
    "expected public-safe runtime surface summary",
  );
  assert.equal(
    process.runtimeFacts.runtimeDeterministic,
    true,
    "expected deterministic public runtime summary",
  );
  assert.equal(
    process.runtimeFacts.runtimeTargetMs,
    10,
    "expected public runtime target to remain present",
  );
  assert.match(markdown, /Agent Buccet Runtime Surface/, "expected public runtime surface markdown");
  assert.ok(
    !/collapse|snapped|snap body|BuccetCollapse|S = I|7-step|7 step|full system body/i.test(markdown),
    "expected public markdown to omit internal methodology terms",
  );

  console.log("Agent Buccet public runtime surface contract");
  console.log("public-safe runtime surface summary: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
