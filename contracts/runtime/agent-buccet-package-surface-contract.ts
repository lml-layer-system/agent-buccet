import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function run(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv,
      },
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
  const buildResult = await run("node", ["scripts/prepare-agent-buccet-package.ts"], repoRoot, {
    AGENT_BUCCET_PACKAGE_SKIP_VERIFY: "1",
  });
  assert.equal(buildResult.code, 0, buildResult.stderr);

  const rootReadme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8");
  assert.doesNotMatch(
    rootReadme,
    /npm install agent-buccet/,
    "root README should not claim an unshipped npm install path",
  );

  const packagedRoot = path.join(repoRoot, "dist", "agent-buccet");
  const packagedJson = JSON.parse(
    await fs.readFile(path.join(packagedRoot, "package.json"), "utf8"),
  ) as {
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

  const releaseInstall = await fs
    .access(path.join(packagedRoot, "releases", "install.sh"))
    .then(() => true)
    .catch(() => false);
  assert.equal(releaseInstall, true, "standalone package should carry hosted install shell");
  const installSnap = await fs
    .access(path.join(packagedRoot, "INSTALL_SNAP.txt"))
    .then(() => true)
    .catch(() => false);
  assert.equal(installSnap, true, "standalone package should carry install snap summary");
  const installSnapJson = await fs
    .access(path.join(packagedRoot, "SNAP_INSTALL.json"))
    .then(() => true)
    .catch(() => false);
  assert.equal(
    installSnapJson,
    true,
    "standalone package should carry machine-readable install snap summary",
  );
  const packagedRuntimeMuscle = await fs
    .access(
      path.join(
        packagedRoot,
        "data",
        "agent-buccet-law-foundation",
        "data",
        "working",
        "active-law-body",
        "runtime-muscle.json",
      ),
    )
    .then(() => true)
    .catch(() => false);
  assert.equal(
    packagedRuntimeMuscle,
    true,
    "standalone package should carry the precomputed runtime-muscle artifact",
  );
  const packagedDenialCatalogSnap = await fs
    .access(
      path.join(
        packagedRoot,
        "data",
        "agent-buccet-law-foundation",
        "data",
        "working",
        "active-law-body",
        "denial-catalog-snap.json",
      ),
    )
    .then(() => true)
    .catch(() => false);
  assert.equal(
    packagedDenialCatalogSnap,
    true,
    "standalone package should carry the precomputed denial catalog artifact",
  );
  const packagedProjectedLawSource = await fs
    .access(
      path.join(
        packagedRoot,
        "data",
        "agent-buccet-law-foundation",
        "data",
        "working",
        "active-law-body",
        "projected-laws.json",
      ),
    )
    .then(() => true)
    .catch(() => false);
  assert.equal(
    packagedProjectedLawSource,
    false,
    "standalone package should not ship the rich active law source body",
  );
  const packagedRustSubstrate = await fs
    .access(path.join(packagedRoot, "native", "buccet-substrate-rust", "Cargo.toml"))
    .then(() => true)
    .catch(() => false);
  assert.equal(
    packagedRustSubstrate,
    true,
    "standalone package should carry the vendored Buccet Rust substrate",
  );
  const packagedRustWasm = await fs
    .access(
      path.join(packagedRoot, "native", "buccet-substrate-rust", "pkg", "buccet_substrate_bg.wasm"),
    )
    .then(() => true)
    .catch(() => false);
  assert.equal(
    packagedRustWasm,
    true,
    "standalone package should carry the vendored Buccet Rust substrate WASM package",
  );
  const packagedRustAdapter = await fs
    .access(path.join(packagedRoot, "src", "runtime", "substrate", "substrate-rust.ts"))
    .then(() => true)
    .catch(() => false);
  assert.equal(
    packagedRustAdapter,
    true,
    "standalone package should carry the Buccet TS adapter for the Rust substrate",
  );
  const packagedRustLiveBridge = await fs
    .access(path.join(packagedRoot, "src", "runtime", "substrate", "substrate-live.ts"))
    .then(() => true)
    .catch(() => false);
  assert.equal(
    packagedRustLiveBridge,
    true,
    "standalone package should carry the Buccet live runtime bridge for the Rust substrate",
  );
  const nativeLibraryName =
    process.platform === "darwin" ? "libbuccet-hook.dylib" : "libbuccet-hook.so";
  const packagedNativeHookPath = path.join(packagedRoot, "native", "build", nativeLibraryName);
  const packagedNativeHook = await fs
    .access(packagedNativeHookPath)
    .then(() => true)
    .catch(() => false);
  const packagedDocs = await fs.readdir(path.join(packagedRoot, "docs"));
  assert.equal(
    packagedDocs.includes("BUCCET_FULL_SYSTEM_BODY.md"),
    false,
    "standalone package should not ship internal methodology markdown under docs/",
  );
  assert.equal(
    packagedDocs.includes("BUCCET_SYSTEM_SUBSTRATE.md"),
    false,
    "standalone package should not expose the internal system substrate document",
  );

  if (packagedNativeHook) {
    await fs.rm(packagedNativeHookPath, { force: true });
    const rebuildResult = await run("node", ["scripts/prepare-agent-buccet-package.ts"], repoRoot, {
      AGENT_BUCCET_PACKAGE_SKIP_VERIFY: "1",
    });
    assert.equal(rebuildResult.code, 0, rebuildResult.stderr);
    const rebuiltNativeHook = await fs
      .access(packagedNativeHookPath)
      .then(() => true)
      .catch(() => false);
    assert.equal(
      rebuiltNativeHook,
      true,
      "package freshness check should rebuild the prebuilt native hook when it is missing",
    );
  }

  console.log("Agent Buccet package surface contract");
  console.log("  root README install claim: truthful");
  console.log("  standalone package: publishable metadata present");
  console.log("  buccet bin: wired");
  console.log("  release shell: present");
  console.log("  install snap summary: present");
  console.log(
    `  runtime classification artifacts: ${packagedRuntimeMuscle && packagedDenialCatalogSnap ? "present" : "missing"}`,
  );
  console.log(`  packaged rust substrate: ${packagedRustSubstrate ? "present" : "missing"}`);
  console.log(
    `  packaged rust wasm bridge: ${packagedRustWasm && packagedRustAdapter && packagedRustLiveBridge ? "present" : "missing"}`,
  );
  console.log(
    `  packaged native hook freshness: ${packagedNativeHook ? "enforced" : "skipped (no prebuilt hook on this machine)"}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
