import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const crateRoot = path.join(repoRoot, "native", "buccet-substrate-rust");

function run(command: string, args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function main() {
  const requiredFiles = [
    "Cargo.toml",
    "README.md",
    "pkg/buccet_substrate.js",
    "pkg/buccet_substrate_bg.js",
    "pkg/buccet_substrate_bg.wasm",
    "pkg/buccet_substrate.d.ts",
    "src/lib.rs",
    "src/types.rs",
    "src/d_containment.rs",
    "src/k_orchestration.rs",
    "src/q_trust.rs",
  ];

  for (const relativePath of requiredFiles) {
    const absolutePath = path.join(crateRoot, relativePath);
    const exists = await fs.access(absolutePath).then(() => true).catch(() => false);
    assert.equal(exists, true, `missing vendored rust substrate file: ${relativePath}`);
  }

  const cargoResult = await run(
    "cargo",
    ["build", "--manifest-path", path.join(crateRoot, "Cargo.toml"), "--release"],
    repoRoot,
  );
  assert.equal(cargoResult.code, 0, cargoResult.stderr);

  const targetReleaseDir = path.join(crateRoot, "target", "release");
  const builtEntries = await fs.readdir(targetReleaseDir).catch(() => []);
  assert.ok(builtEntries.length > 0, "expected cargo build to produce release artifacts");

  const adapterPath = path.join(repoRoot, "lib", "agent-buccet", "substrate-rust.ts");
  const adapterExists = await fs.access(adapterPath).then(() => true).catch(() => false);
  assert.equal(adapterExists, true, "expected Buccet TypeScript adapter for the Rust substrate");

  const loaderScript = `
    import { substrate, PolicyDecision } from ${JSON.stringify(new URL("../lib/agent-buccet/substrate-rust.ts", `file://${path.join(repoRoot, "scripts", "agent-buccet-substrate-rust-contract.ts")}`).href)};
    await substrate.init();
    const isolation = substrate.dApplyIsolation("unit-1", {});
    const decision = substrate.enforce("agent-1", {
      subject: "agent",
      action: "write",
      resource: "secret",
      roles: [],
    });
    const trust = substrate.qAssignTrustDomain("vault-01", {});
    console.log(JSON.stringify({ ready: substrate.ready, active: isolation.active, decision, trust, deny: PolicyDecision.Deny }));
  `;
  const loaderResult = await run(
    "node",
    ["--experimental-wasm-modules", "--input-type=module", "-e", loaderScript],
    repoRoot,
  );
  assert.equal(loaderResult.code, 0, loaderResult.stderr);
  const loaderPayload = JSON.parse(loaderResult.stdout.trim()) as {
    ready: boolean;
    active: boolean;
    decision: string;
    trust: string;
    deny: string;
  };
  assert.equal(loaderPayload.ready, true);
  assert.equal(loaderPayload.decision, loaderPayload.deny);
  assert.equal(loaderPayload.trust, "vault");

  console.log("Agent Buccet substrate rust contract");
  console.log("  vendored crate: present");
  console.log("  native cargo build: ok");
  console.log("  wasm pkg: present");
  console.log("  typescript adapter: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
