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

  console.log("Agent Buccet substrate rust contract");
  console.log("  vendored crate: present");
  console.log("  native cargo build: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
