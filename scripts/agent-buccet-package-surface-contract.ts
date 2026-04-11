import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();

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
  const buildResult = await run("node", ["scripts/prepare-agent-buccet-package.ts"], repoRoot);
  assert.equal(buildResult.code, 0, buildResult.stderr);

  const rootReadme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8");
  assert.doesNotMatch(rootReadme, /npm install agent-buccet/, "root README should not claim an unshipped npm install path");
  assert.match(rootReadme, /BUCCET_FULL_SYSTEM_BODY/, "root README should expose the renamed full-system-body document");
  assert.doesNotMatch(rootReadme, /BUCCET_[A-Z]+_SUBSTRATE_PROCESS/, "root README should not expose the old full-system-body filename");
  const docsIndex = await fs.readFile(path.join(repoRoot, "docs", "agent-boundary", "README.md"), "utf8");
  assert.match(docsIndex, /BUCCET_FULL_SYSTEM_BODY/, "docs index should expose the renamed full-system-body document");
  assert.doesNotMatch(docsIndex, /BUCCET_[A-Z]+_SUBSTRATE_PROCESS/, "docs index should not expose the old full-system-body filename");

  const packagedRoot = path.join(repoRoot, "dist", "agent-buccet");
  const packagedJson = JSON.parse(await fs.readFile(path.join(packagedRoot, "package.json"), "utf8")) as {
    name?: string;
    private?: boolean;
    main?: string;
    exports?: Record<string, string>;
    bin?: Record<string, string>;
    repository?: { url?: string };
    scripts?: Record<string, string>;
  };

  assert.equal(packagedJson.name, "agent-buccet");
  assert.notEqual(packagedJson.private, true, "standalone package surface must be publishable");
  assert.equal(packagedJson.main, "./src/index.ts");
  assert.equal(packagedJson.exports?.["."], "./src/index.ts");
  assert.equal(packagedJson.bin?.buccet, "./bin/buccet.ts");
  assert.equal(packagedJson.repository?.url, "https://github.com/lml-layer-system/agent-buccet");
  assert.equal(packagedJson.scripts?.["install:agent-buccet"], "sh install.sh");

  const releaseInstall = await fs.access(path.join(packagedRoot, "releases", "install.sh")).then(() => true).catch(() => false);
  assert.equal(releaseInstall, true, "standalone package should carry hosted install shell");
  const installSnap = await fs.access(path.join(packagedRoot, "INSTALL_SNAP.txt")).then(() => true).catch(() => false);
  assert.equal(installSnap, true, "standalone package should carry install snap summary");
  const installSnapJson = await fs.access(path.join(packagedRoot, "SNAP_INSTALL.json")).then(() => true).catch(() => false);
  assert.equal(installSnapJson, true, "standalone package should carry machine-readable install snap summary");
  const fullSystemBodyDoc = await fs.access(path.join(packagedRoot, "docs", "BUCCET_FULL_SYSTEM_BODY.md")).then(() => true).catch(() => false);
  assert.equal(fullSystemBodyDoc, true, "standalone package should carry the renamed full system body document");
  const packagedRustSubstrate = await fs.access(path.join(packagedRoot, "native", "buccet-substrate-rust", "Cargo.toml")).then(() => true).catch(() => false);
  assert.equal(packagedRustSubstrate, true, "standalone package should carry the vendored Buccet Rust substrate");
  const packagedRustWasm = await fs.access(path.join(packagedRoot, "native", "buccet-substrate-rust", "pkg", "buccet_substrate_bg.wasm")).then(() => true).catch(() => false);
  assert.equal(packagedRustWasm, true, "standalone package should carry the vendored Buccet Rust substrate WASM package");
  const packagedRustAdapter = await fs.access(path.join(packagedRoot, "src", "substrate-rust.ts")).then(() => true).catch(() => false);
  assert.equal(packagedRustAdapter, true, "standalone package should carry the Buccet TS adapter for the Rust substrate");
  const nativeLibraryName = process.platform === "darwin" ? "libbuccet-hook.dylib" : "libbuccet-hook.so";
  const packagedNativeHookPath = path.join(packagedRoot, "native", "build", nativeLibraryName);
  const packagedNativeHook = await fs.access(packagedNativeHookPath).then(() => true).catch(() => false);
  const packagedDocs = await fs.readdir(path.join(packagedRoot, "docs"));
  assert.equal(packagedDocs.includes("BUCCET_FULL_SYSTEM_BODY.md"), true, "standalone package should surface the renamed full system body document");
  assert.equal(packagedDocs.some((entry) => /^BUCCET_[A-Z]+_SUBSTRATE_PROCESS\.md$/.test(entry)), false, "standalone package should not carry the old full-system-body filename");

  if (packagedNativeHook) {
    await fs.rm(packagedNativeHookPath, { force: true });
    const rebuildResult = await run("node", ["scripts/prepare-agent-buccet-package.ts"], repoRoot);
    assert.equal(rebuildResult.code, 0, rebuildResult.stderr);
    const rebuiltNativeHook = await fs.access(packagedNativeHookPath).then(() => true).catch(() => false);
    assert.equal(rebuiltNativeHook, true, "package freshness check should rebuild the prebuilt native hook when it is missing");
  }

  console.log("Agent Buccet package surface contract");
  console.log("  root README install claim: truthful");
  console.log("  standalone package: publishable metadata present");
  console.log("  buccet bin: wired");
  console.log("  release shell: present");
  console.log("  install snap summary: present");
  console.log(`  packaged rust substrate: ${packagedRustSubstrate ? "present" : "missing"}`);
  console.log(`  packaged rust wasm bridge: ${packagedRustWasm && packagedRustAdapter ? "present" : "missing"}`);
  console.log(`  packaged native hook freshness: ${packagedNativeHook ? "enforced" : "skipped (no prebuilt hook on this machine)"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
