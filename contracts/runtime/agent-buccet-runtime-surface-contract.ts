import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import { BOUNDARY_BUCCET_LAW_BODY_DENIAL_ROWS } from "./../../src/law/buccet-law-body-denial-catalog.ts";
import { loadAgentBuccetRuntimeMuscle } from "./../../src/runtime/foundation.ts";
import { loadUserPathLedger } from "./../../src/proof/user-path-ledger.ts";
import { substrate } from "./../../src/runtime/substrate/substrate-rust.ts";

const repoRoot = process.cwd();

const ACTIVE_LAW_BODY_MANIFEST = "data/agent-buccet-law-foundation/data/working/active-law-body/manifest.json";
const ACTIVE_LAW_BODY_SOURCE = "data/agent-buccet-law-foundation/data/working/active-law-body/projected-laws.json";
const ACTIVE_RUNTIME_MUSCLE = "data/agent-buccet-law-foundation/data/working/active-law-body/runtime-muscle.json";
const ACTIVE_DENIAL_CATALOG_SNAP = "data/agent-buccet-law-foundation/data/working/active-law-body/denial-catalog-snap.json";
const USER_PATH_LEDGER = "data/agent-buccet-law-foundation/user-path-ledger.json";
const RUST_SUBSTRATE_BG = "native/buccet-substrate-rust/pkg/buccet_substrate_bg.js";
const RUST_SUBSTRATE_WASM = "native/buccet-substrate-rust/pkg/buccet_substrate_bg.wasm";
const PHYSWRAP_BUILD_SCRIPT = "native/physwrap/build.sh";
const PHYSWRAP_SOURCE = "native/physwrap/physwrap.c";
const NATIVE_DEEP_INTERCEPT_DIR = "native/deep-intercept";
const NATIVE_DEEP_INTERCEPT_BUILD = "native/deep-intercept/build.sh";

const HOT_MODULES = [
  "src/runtime/foundation.ts",
  "src/law/buccet-law-body-denial-catalog.ts",
  "src/law/headless-base-denials.ts",
  "src/proof/user-path-ledger.ts",
  "src/runtime/substrate/substrate-rust.ts",
  "src/runtime/process.ts",
  "cli/buccet.ts",
  "scripts/agent-buccet-mcp-server.ts",
] as const;

const READ_SURFACE_PATTERNS = [
  "docs/",
  "data/agent-buccet-law-foundation/data/working/base-law-runtime-corpus",
  "data/agent-buccet-law-foundation/data/working/time-law-runtime-corpus",
  "data/agent-buccet-law-foundation/data/working/base-law-families",
  "data/agent-buccet-law-foundation/data/working/base-law-section-map.json",
] as const;

async function mustExist(relativePath: string): Promise<void> {
  await fs.access(path.join(repoRoot, relativePath));
}

async function read(relativePath: string): Promise<string> {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

async function main() {
  const snappedInputs = [
    ACTIVE_LAW_BODY_MANIFEST,
    ACTIVE_LAW_BODY_SOURCE,
    ACTIVE_RUNTIME_MUSCLE,
    ACTIVE_DENIAL_CATALOG_SNAP,
    USER_PATH_LEDGER,
    RUST_SUBSTRATE_BG,
    RUST_SUBSTRATE_WASM,
    PHYSWRAP_BUILD_SCRIPT,
    PHYSWRAP_SOURCE,
    NATIVE_DEEP_INTERCEPT_DIR,
    NATIVE_DEEP_INTERCEPT_BUILD,
  ];

  await Promise.all(snappedInputs.map((relativePath) => mustExist(relativePath)));

  const hotSources = await Promise.all(
    HOT_MODULES.map(async (relativePath) => ({
      relativePath,
      source: await read(relativePath),
    })),
  );

  for (const { relativePath, source } of hotSources) {
    for (const forbidden of READ_SURFACE_PATTERNS) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not treat read-surface archive ${forbidden} as a hot runtime input`,
      );
    }
  }

  const foundationSource = hotSources.find((entry) => entry.relativePath === "src/runtime/foundation.ts")?.source ?? "";
  assert.match(foundationSource, /active-law-body/, "foundation should load runtime from active law body");
  assert.doesNotMatch(foundationSource, /projected-laws\.json/, "foundation should not hot-load the rich active law rows");
  assert.match(foundationSource, /runtime-muscle\.json/, "foundation should load the snapped runtime muscle artifact");

  const denialCatalogSource = hotSources.find((entry) => entry.relativePath === "src/law/buccet-law-body-denial-catalog.ts")?.source ?? "";
  assert.doesNotMatch(
    denialCatalogSource,
    /projected-laws\.json/,
    "law-body denial catalog should not hot-load the rich active law rows",
  );
  assert.match(
    denialCatalogSource,
    /denial-catalog-snap\.json/,
    "law-body denial catalog should load the snapped denial catalog artifact",
  );

  const ledgerSource = hotSources.find((entry) => entry.relativePath === "src/proof/user-path-ledger.ts")?.source ?? "";
  assert.match(ledgerSource, /user-path-ledger\.json/, "UPL runtime should anchor to the live user-path ledger");

  const processSource = hotSources.find((entry) => entry.relativePath === "src/runtime/process.ts")?.source ?? "";
  assert.match(processSource, /native\/physwrap\/build/, "process runtime should anchor to the native physwrap binary");

  const substrateSource = hotSources.find((entry) => entry.relativePath === "src/runtime/substrate/substrate-rust.ts")?.source ?? "";
  assert.match(substrateSource, /native\/buccet-substrate-rust\/pkg/, "substrate runtime should anchor to vendored WASM assets");

  const cliSource = hotSources.find((entry) => entry.relativePath === "cli/buccet.ts")?.source ?? "";
  assert.match(cliSource, /deep-intercept/, "buccet runtime should anchor hook build/install to native deep intercept");
  assert.match(cliSource, /boundary\.substrate\.init\(\)/, "transport runtime should initialize the shared substrate");
  assert.match(cliSource, /boundary\.substrate\.applyIsolation/, "transport runtime should enter isolation through the shared substrate");
  assert.match(cliSource, /boundary\.substrate\.persistState/, "transport runtime should persist packaged state through the shared substrate");
  assert.match(cliSource, /boundary\.substrate\.enterEnvironment/, "transport runtime should enter packaged environment through the shared substrate");
  assert.match(cliSource, /resolveTransportExecutable/, "transport runtime should resolve commands from inside the packaged rootfs");

  const mcpSource = hotSources.find((entry) => entry.relativePath === "scripts/agent-buccet-mcp-server.ts")?.source ?? "";
  assert.match(mcpSource, /evaluateBoundaryIntercept/, "MCP runtime should route tool calls through boundary intercept");
  assert.match(mcpSource, /enableBodyguardControl/, "MCP runtime should use the shared bodyguard-controlled config");
  assert.match(mcpSource, /provenance "mcp_host"|provenance: "mcp_host"/, "MCP runtime should ledger its provenance as mcp_host");

  const runtimeMuscle = await loadAgentBuccetRuntimeMuscle();
  assert.equal(
    runtimeMuscle.manifest.artifactPaths.substrate,
    ACTIVE_RUNTIME_MUSCLE,
    "runtime muscle should anchor to the snapped runtime-muscle artifact",
  );
  assert.equal(
    runtimeMuscle.manifest.artifactPaths.activeLawBodySource,
    ACTIVE_LAW_BODY_SOURCE,
    "runtime muscle should retain lineage back to the rich active law source",
  );
  assert.ok(runtimeMuscle.activeLawIds.length > 0, "runtime muscle should load active law ids from the snapped law body");
  assert.ok(
    BOUNDARY_BUCCET_LAW_BODY_DENIAL_ROWS.length > 8000,
    "runtime should load the snapped law-body denial catalog",
  );

  const ledger = await loadUserPathLedger();
  assert.ok(
    ledger.userApprovedLawPaths.length + ledger.userDeniedLawPaths.length > 0,
    "runtime should load the live UPL ledger from the snapped ledger artifact",
  );

  await substrate.init();
  assert.equal(substrate.ready, true, "runtime should bootstrap the vendored Rust/WASM substrate");

  console.log("Agent Buccet runtime surface contract");
  console.log(`  run-surface law manifest:     ${ACTIVE_LAW_BODY_MANIFEST}`);
  console.log(`  run-surface law muscle:       ${ACTIVE_RUNTIME_MUSCLE}`);
  console.log(`  run-surface denial catalog:   ${ACTIVE_DENIAL_CATALOG_SNAP}`);
  console.log(`  run-surface UPL ledger:       ${USER_PATH_LEDGER}`);
  console.log(`  read-surface law source:      ${ACTIVE_LAW_BODY_SOURCE}`);
  console.log(`  run-surface physwrap lane:    ${PHYSWRAP_BUILD_SCRIPT}`);
  console.log(`  run-surface physwrap source:  ${PHYSWRAP_SOURCE}`);
  console.log(`  run-surface hook source:      ${NATIVE_DEEP_INTERCEPT_DIR}`);
  console.log(`  run-surface rust bridge:      ${RUST_SUBSTRATE_BG}`);
  console.log(`  run-surface rust wasm:        ${RUST_SUBSTRATE_WASM}`);
  console.log("  read-surface archives:        excluded from hot runtime references");
  console.log("  transport chain:              snapped runtime path");
  console.log("  MCP path:                     same Buccet body, no parallel logic");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
