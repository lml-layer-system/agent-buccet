import { execSync } from "node:child_process";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function run(command: string): void {
  console.log(`\n$ ${command}`);
  execSync(command, {
    stdio: "inherit",
    env: process.env,
  });
}

function main() {
  const signoff = (process.env.RELEASE_SIGNOFF ?? "").trim();
  const releaseId = (process.env.RELEASE_ID ?? "").trim();

  assert(signoff.length > 0 && signoff !== "UNSIGNED", "RELEASE_SIGNOFF is required and must not be UNSIGNED.");
  assert(releaseId.length > 0, "RELEASE_ID is required.");

  run("npm run lint");
  run("npm run build");
  run("npm run verify:freeze");
  run("npm run ci:guardrails");
  run("npm run test:demo-contract");
  run("npm run test:gpt2-live");
  run("npm run test:legal-safety");
  run("npm run test:replay");
  run("npm run test:product-api");
  run("npm run release:manifest");
  run("npm run verify:manifest");
  run("npm run report:blockers");
  run("npm run report:coverage");

  console.log("\nrelease:all-gates completed successfully.");
}

main();
