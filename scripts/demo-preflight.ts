import { assertApiLawReadiness } from "../lib/engine/readiness.ts";
import { verifyFreeze } from "./verify-freeze.ts";

async function main() {
  await verifyFreeze();
  await assertApiLawReadiness();
  console.log("Demo preflight passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

