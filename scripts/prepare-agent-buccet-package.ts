import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import {
  publishBoundaryReleaseWitness,
  type BoundaryReleaseWitnessStatus,
} from "./../src/index.ts";
import {
  buildBuccetInstallSnapSummary,
  renderBuccetInstallSnapSummaryText,
  runBuccetFullSystemBody,
} from "./../src/runtime/full-system-body.ts";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "dist", "agent-buccet");
const releaseDir = path.join(repoRoot, "dist", "releases");
const sourceRuntimeDir = path.join(repoRoot, "src");
const sourceDocsDir = path.join(repoRoot, "docs");
const sourceLawFoundationDir = path.join(repoRoot, "data", "agent-buccet-law-foundation");
const packagedDocs = [
  "README.md",
  "quickstart.md",
  "current-limits.md",
  "security-model.md",
  "public-private-boundary.md",
  "guides/mcp-server.md",
] as const;
const packagedLawFoundationFiles = [
  "data/working/active-law-body/manifest.json",
  "data/working/active-law-body/runtime-muscle.json",
  "data/working/active-law-body/denial-catalog-snap.json",
  "user-path-ledger.json",
  "user-path-ledger-spec.json",
  "data/working/user-path-ledger-spec.json",
] as const;
const sourceExample = path.join(repoRoot, "scripts", "agent-buccet-e2e.ts");
const sourceGravityExample = path.join(repoRoot, "scripts", "agent-buccet-gravity-e2e.ts");
const sourceGravityContract = path.join(repoRoot, "contracts", "engines", "agent-buccet-gravity-contract.ts");
const sourceLedgerContract = path.join(repoRoot, "contracts", "proof", "agent-buccet-ledger-contract.ts");
const sourceLedgerRollupContract = path.join(repoRoot, "contracts", "proof", "agent-buccet-ledger-rollup-contract.ts");
const sourceLedgerWriterContract = path.join(repoRoot, "contracts", "proof", "agent-buccet-ledger-writer-contract.ts");
const sourceLedgerWitnessContract = path.join(repoRoot, "contracts", "proof", "agent-buccet-ledger-witness-contract.ts");
const sourceGravitySupervisorContract = path.join(repoRoot, "contracts", "engines", "agent-buccet-gravity-supervisor-contract.ts");
const sourceActionClassesContract = path.join(repoRoot, "contracts", "runtime", "agent-buccet-action-classes-contract.ts");
const sourceInterceptDaemonContract = path.join(repoRoot, "contracts", "runtime", "agent-buccet-intercept-daemon-contract.ts");
const sourceInterceptServerContract = path.join(repoRoot, "contracts", "runtime", "agent-buccet-intercept-server-contract.ts");
const sourceSystemInterceptContract = path.join(repoRoot, "contracts", "runtime", "agent-buccet-system-intercept-contract.ts");
const sourceGravityBridgeContract = path.join(repoRoot, "contracts", "engines", "agent-buccet-gravity-bridge-contract.ts");
const sourceSwarmContract = path.join(repoRoot, "contracts", "runtime", "agent-buccet-swarm-contract.ts");
const sourceHookRuntimeContract = path.join(repoRoot, "contracts", "runtime", "agent-buccet-hook-runtime-contract.ts");
const sourceWrapperContract = path.join(repoRoot, "contracts", "runtime", "agent-buccet-wrapper-contract.ts");
const sourceCliContract = path.join(repoRoot, "contracts", "cli", "agent-buccet-cli-contract.ts");
const sourceInstallContract = path.join(repoRoot, "contracts", "cli", "agent-buccet-install-contract.ts");
const sourceHostedInstallContract = path.join(repoRoot, "contracts", "cli", "agent-buccet-hosted-install-contract.ts");
const sourceReleaseWitnessContract = path.join(repoRoot, "contracts", "proof", "agent-buccet-release-witness-contract.ts");
const sourceWrapperScript = path.join(repoRoot, "scripts", "agent-buccet-run.ts");
const sourceCliScript = path.join(repoRoot, "cli", "buccet.ts");
const sourceGravityDaemonScript = path.join(repoRoot, "scripts", "agent-buccet-gravity-daemon.ts");
const sourceInterceptDaemonScript = path.join(repoRoot, "scripts", "agent-buccet-intercept-daemon.ts");
const sourceInterceptServerScript = path.join(repoRoot, "scripts", "agent-buccet-intercept-server.ts");
const sourceGravityBridgeScript = path.join(repoRoot, "scripts", "agent-buccet-gravity-bridge.ts");
const sourceHookDaemonScript = path.join(repoRoot, "scripts", "agent-buccet-hook-daemon.ts");
const sourceSystemInterceptBridgeScript = path.join(repoRoot, "scripts", "agent-buccet-system-intercept-bridge.ts");
const sourceLedgerWriterScript = path.join(repoRoot, "scripts", "agent-buccet-ledger-writer.ts");
const sourceLedgerCliScript = path.join(repoRoot, "scripts", "agent-buccet-ledger-cli.ts");
const sourceMcpServerScript = path.join(repoRoot, "scripts", "agent-buccet-mcp-server.ts");
const sourceInstallScript = path.join(repoRoot, "scripts", "install-agent-buccet.sh");
const sourceHostedInstallScript = path.join(repoRoot, "scripts", "install-agent-buccet-hosted.sh");
const sourceNativeDir = path.join(repoRoot, "native");
const packageBuildStatePath = path.join(outDir, "PACKAGE_BUILD_STATE.json");

type PackageBuildState = {
  version: string;
  inputHash: string;
  generatedAt: string;
  outputHashes: Record<string, string>;
};

async function rmrf(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function mkdirp(targetPath: string) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        LC_ALL: process.env.LC_ALL ?? "C",
        LANG: process.env.LANG ?? "C",
        LC_CTYPE: process.env.LC_CTYPE ?? "C",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const filteredStderr = stderr
        .split("\n")
        .filter((line) => line.trim() !== "tar: Failed to set default locale")
        .join("\n")
        .trim();
      if (filteredStderr) {
        process.stderr.write(`${filteredStderr}\n`);
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function copyDir(src: string, dest: string): Promise<void> {
  await mkdirp(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }
    await fs.copyFile(srcPath, destPath);
  }
}

async function copyRelativePath(sourceBaseDir: string, relativePath: string, destBaseDir: string): Promise<void> {
  const sourcePath = path.join(sourceBaseDir, relativePath);
  const destPath = path.join(destBaseDir, relativePath);
  const stats = await fs.stat(sourcePath);
  if (stats.isDirectory()) {
    await copyDir(sourcePath, destPath);
    return;
  }
  await mkdirp(path.dirname(destPath));
  await fs.copyFile(sourcePath, destPath);
}

async function readPackageVersion(): Promise<string> {
  const raw = await fs.readFile(path.join(repoRoot, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.1.0";
}

async function walkRelativeFiles(rootPath: string, relativeRoot: string): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      continue;
    }
    const absPath = path.join(rootPath, entry.name);
    const relPath = path.join(relativeRoot, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) {
      out.push(...await walkRelativeFiles(absPath, relPath));
      continue;
    }
    if (entry.isFile()) {
      out.push(relPath);
    }
  }
  return out;
}

async function computePackageInputHash(): Promise<string> {
  const hash = createHash("sha256");
  const directoryInputs = [
    { rootPath: sourceRuntimeDir, relativeRoot: "src" },
    { rootPath: sourceNativeDir, relativeRoot: "native" },
  ];
  const fileInputs = [
    "package.json",
    ...packagedDocs.map((relativePath) => path.join("docs", relativePath).split(path.sep).join("/")),
    ...packagedLawFoundationFiles.map((relativePath) =>
      path.join("data/agent-buccet-law-foundation", relativePath).split(path.sep).join("/")
    ),
    "data/agent-buccet-law-foundation/data/working/active-law-body/projected-laws.json",
    "scripts/prepare-agent-buccet-package.ts",
    "scripts/agent-buccet-runtime-snap-shared.ts",
    "scripts/render-agent-buccet-runtime-snaps.ts",
    "contracts/runtime/agent-buccet-runtime-snap-contract.ts",
    "contracts/runtime/agent-buccet-package-surface-contract.ts",
    "scripts/install-agent-buccet.sh",
    "scripts/install-agent-buccet-hosted.sh",
    "contracts/cli/agent-buccet-install-contract.ts",
    "contracts/cli/agent-buccet-hosted-install-contract.ts",
    "contracts/proof/agent-buccet-release-witness-contract.ts",
    "scripts/agent-buccet-e2e.ts",
    "scripts/agent-buccet-gravity-e2e.ts",
    "contracts/engines/agent-buccet-gravity-contract.ts",
    "contracts/proof/agent-buccet-ledger-contract.ts",
    "contracts/proof/agent-buccet-ledger-rollup-contract.ts",
    "contracts/proof/agent-buccet-ledger-writer-contract.ts",
    "contracts/proof/agent-buccet-ledger-witness-contract.ts",
    "contracts/engines/agent-buccet-gravity-supervisor-contract.ts",
    "contracts/runtime/agent-buccet-action-classes-contract.ts",
    "contracts/runtime/agent-buccet-intercept-daemon-contract.ts",
    "contracts/runtime/agent-buccet-intercept-server-contract.ts",
    "contracts/runtime/agent-buccet-system-intercept-contract.ts",
    "contracts/engines/agent-buccet-gravity-bridge-contract.ts",
    "contracts/runtime/agent-buccet-swarm-contract.ts",
    "contracts/runtime/agent-buccet-hook-runtime-contract.ts",
    "contracts/runtime/agent-buccet-wrapper-contract.ts",
    "contracts/cli/agent-buccet-cli-contract.ts",
    "scripts/agent-buccet-run.ts",
    "cli/buccet.ts",
    "scripts/agent-buccet-mcp-server.ts",
    "scripts/agent-buccet-gravity-daemon.ts",
    "scripts/agent-buccet-intercept-daemon.ts",
    "scripts/agent-buccet-intercept-server.ts",
    "scripts/agent-buccet-gravity-bridge.ts",
    "scripts/agent-buccet-hook-daemon.ts",
    "scripts/agent-buccet-system-intercept-bridge.ts",
    "scripts/agent-buccet-ledger-writer.ts",
    "scripts/agent-buccet-ledger-cli.ts",
  ];

  const relativePaths = new Set<string>();
  for (const directoryInput of directoryInputs) {
    const files = await walkRelativeFiles(directoryInput.rootPath, directoryInput.relativeRoot);
    for (const file of files) {
      relativePaths.add(file);
    }
  }
  for (const fileInput of fileInputs) {
    relativePaths.add(fileInput);
  }

  for (const relativePath of [...relativePaths].sort((left, right) => left.localeCompare(right))) {
    const absolutePath = path.join(repoRoot, relativePath);
    const buffer = await fs.readFile(absolutePath);
    hash.update(`${relativePath}\n`);
    hash.update(buffer);
    hash.update("\n");
  }
  return hash.digest("hex");
}

async function computeFileHash(targetPath: string): Promise<string> {
  const buffer = await fs.readFile(targetPath);
  return createHash("sha256").update(buffer).digest("hex");
}

function packagedNativeHookArtifactTarget(): { relativePath: string; absolutePath: string } {
  const nativeLibraryName = process.platform === "darwin"
    ? "libbuccet-hook.dylib"
    : "libbuccet-hook.so";
  return {
    relativePath: `native/build/${nativeLibraryName}`,
    absolutePath: path.join(outDir, "native", "build", nativeLibraryName),
  };
}

function requiredPackageFreshnessTargets(version: string): Array<{ relativePath: string; absolutePath: string }> {
  const archiveBaseName = `agent-buccet-${version}.tar.gz`;
  return [
    { relativePath: "install.sh", absolutePath: path.join(outDir, "install.sh") },
    { relativePath: "INSTALL_SNAP.txt", absolutePath: path.join(outDir, "INSTALL_SNAP.txt") },
    { relativePath: "SNAP_INSTALL.json", absolutePath: path.join(outDir, "SNAP_INSTALL.json") },
    { relativePath: "package.json", absolutePath: path.join(outDir, "package.json") },
    { relativePath: "releases/install.sh", absolutePath: path.join(releaseDir, "install.sh") },
    { relativePath: "releases/latest.json", absolutePath: path.join(releaseDir, "latest.json") },
    { relativePath: `releases/${archiveBaseName}`, absolutePath: path.join(releaseDir, archiveBaseName) },
    { relativePath: `releases/${archiveBaseName}.sha256`, absolutePath: path.join(releaseDir, `${archiveBaseName}.sha256`) },
  ];
}

async function optionalPackageFreshnessTargets(): Promise<Array<{ relativePath: string; absolutePath: string }>> {
  const nativeHookTarget = packagedNativeHookArtifactTarget();
  return await fs.access(nativeHookTarget.absolutePath)
    .then(() => [nativeHookTarget])
    .catch(() => []);
}

async function readPackageBuildState(): Promise<PackageBuildState | null> {
  try {
    const raw = await fs.readFile(packageBuildStatePath, "utf8");
    return JSON.parse(raw) as PackageBuildState;
  } catch {
    return null;
  }
}

async function packageArtifactsAreFresh(inputHash: string, version: string): Promise<boolean> {
  const state = await readPackageBuildState();
  if (!state || state.inputHash !== inputHash || state.version !== version) {
    return false;
  }
  const requiredTargets = requiredPackageFreshnessTargets(version);
  const knownTargets = new Map(requiredTargets.map((target) => [target.relativePath, target]));
  knownTargets.set(packagedNativeHookArtifactTarget().relativePath, packagedNativeHookArtifactTarget());

  for (const target of requiredTargets) {
    const expectedHash = state.outputHashes[target.relativePath];
    if (!expectedHash) {
      return false;
    }
    try {
      const actualHash = await computeFileHash(target.absolutePath);
      if (actualHash !== expectedHash) {
        return false;
      }
    } catch {
      return false;
    }
  }

  for (const [relativePath, expectedHash] of Object.entries(state.outputHashes)) {
    if (requiredTargets.some((target) => target.relativePath === relativePath)) {
      continue;
    }
    const target = knownTargets.get(relativePath);
    if (!target) {
      return false;
    }
    try {
      const actualHash = await computeFileHash(target.absolutePath);
      if (actualHash !== expectedHash) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

async function writePackageBuildState(inputHash: string, version: string) {
  const targets = [
    ...requiredPackageFreshnessTargets(version),
    ...await optionalPackageFreshnessTargets(),
  ];
  const outputHashes = Object.fromEntries(
    await Promise.all(targets.map(async (target) => {
      return [target.relativePath, await computeFileHash(target.absolutePath)] as const;
    })),
  );
  const state: PackageBuildState = {
    version,
    inputHash,
    generatedAt: new Date().toISOString(),
    outputHashes,
  };
  await fs.writeFile(packageBuildStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function writeStandalonePackageJson() {
  const version = await readPackageVersion();
  const pkg = {
    name: "agent-buccet",
    version,
    description: "Persistent law and scope enforcement for AI agents. Agents can propose. They cannot authorize.",
    keywords: [
      "ai-agents",
      "safety",
      "containment",
      "boundary",
      "llm",
      "policy",
      "audit",
      "ledger",
      "enforcement",
      "authorization",
    ],
    license: "Apache-2.0",
    repository: {
      type: "git",
      url: "https://github.com/lml-layer-system/agent-buccet",
    },
    homepage: "https://github.com/lml-layer-system/agent-buccet#readme",
    bugs: {
      url: "https://github.com/lml-layer-system/agent-buccet/issues",
    },
    type: "module",
    main: "./src/index.ts",
    exports: {
      ".": "./src/index.ts",
    },
    bin: {
      buccet: "./bin/buccet.ts",
    },
    scripts: {
      "demo:agent-buccet": "node examples/agent-buccet-e2e.ts",
      "demo:agent-buccet:gravity": "node examples/agent-buccet-gravity-e2e.ts",
      "test:agent-buccet:gravity-contract": "node examples/agent-buccet-gravity-contract.ts",
      "test:agent-buccet:ledger-contract": "node examples/agent-buccet-ledger-contract.ts",
      "test:agent-buccet:ledger-rollup": "node examples/agent-buccet-ledger-rollup-contract.ts",
      "test:agent-buccet:ledger-writer": "node examples/agent-buccet-ledger-writer-contract.ts",
      "test:agent-buccet:ledger-witness": "node examples/agent-buccet-ledger-witness-contract.ts",
      "test:agent-buccet:gravity-supervisor": "node examples/agent-buccet-gravity-supervisor-contract.ts",
      "test:agent-buccet:wrapper-contract": "node examples/agent-buccet-wrapper-contract.ts",
      "test:agent-buccet:action-classes": "node examples/agent-buccet-action-classes-contract.ts",
      "test:agent-buccet:intercept-daemon": "node examples/agent-buccet-intercept-daemon-contract.ts",
      "test:agent-buccet:intercept-server": "node examples/agent-buccet-intercept-server-contract.ts",
      "test:agent-buccet:system-intercept": "node examples/agent-buccet-system-intercept-contract.ts",
      "test:agent-buccet:gravity-bridge": "node examples/agent-buccet-gravity-bridge-contract.ts",
      "test:agent-buccet:swarm": "node examples/agent-buccet-swarm-contract.ts",
      "test:agent-buccet:hook-runtime": "node examples/agent-buccet-hook-runtime-contract.ts",
      "test:agent-buccet:cli": "node examples/agent-buccet-cli-contract.ts",
      "test:agent-buccet:install": "node examples/agent-buccet-install-contract.ts",
      "test:agent-buccet:hosted-install": "node examples/agent-buccet-hosted-install-contract.ts",
      "test:agent-buccet:release-witness": "node examples/agent-buccet-release-witness-contract.ts",
      "agent-buccet:gravity-daemon": "node bin/agent-buccet-gravity-daemon.ts",
      "agent-buccet:intercept-daemon": "node bin/agent-buccet-intercept-daemon.ts",
      "agent-buccet:intercept-server": "node bin/agent-buccet-intercept-server.ts",
      "agent-buccet:gravity-bridge": "node bin/agent-buccet-gravity-bridge.ts",
      "agent-buccet:hook-daemon": "node bin/agent-buccet-hook-daemon.ts",
      "agent-buccet:system-intercept-bridge": "node bin/agent-buccet-system-intercept-bridge.ts",
      "agent-buccet:ledger-writer": "node bin/agent-buccet-ledger-writer.ts",
      "agent-buccet:ledger": "node bin/agent-buccet-ledger-cli.ts",
      "agent-buccet:run": "node bin/agent-buccet-run.ts",
      "agent-buccet:cli": "node bin/buccet.ts",
      "install:agent-buccet": "sh install.sh",
    },
  };
  await fs.writeFile(
    path.join(outDir, "package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`,
    "utf8",
  );
}

async function writeStandaloneTsconfig() {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "nodenext",
      moduleResolution: "nodenext",
      strict: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
    },
    include: ["src/**/*.ts", "examples/**/*.ts"],
  };
  await fs.writeFile(
    path.join(outDir, "tsconfig.json"),
    `${JSON.stringify(tsconfig, null, 2)}\n`,
    "utf8",
  );
}

async function writeExtractionManifest() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceRuntimeDir: "src",
    sourceDocsDir: "docs",
    sourceLawFoundationDir: "data/agent-buccet-law-foundation",
    sourceExample: "scripts/agent-buccet-e2e.ts",
    sourceGravityExample: "scripts/agent-buccet-gravity-e2e.ts",
    sourceGravityContract: "contracts/engines/agent-buccet-gravity-contract.ts",
    sourceLedgerContract: "contracts/proof/agent-buccet-ledger-contract.ts",
    sourceLedgerRollupContract: "contracts/proof/agent-buccet-ledger-rollup-contract.ts",
    sourceLedgerWriterContract: "contracts/proof/agent-buccet-ledger-writer-contract.ts",
    sourceLedgerWitnessContract: "contracts/proof/agent-buccet-ledger-witness-contract.ts",
    sourceGravitySupervisorContract: "contracts/engines/agent-buccet-gravity-supervisor-contract.ts",
    sourceActionClassesContract: "contracts/runtime/agent-buccet-action-classes-contract.ts",
    sourceInterceptDaemonContract: "contracts/runtime/agent-buccet-intercept-daemon-contract.ts",
    sourceInterceptServerContract: "contracts/runtime/agent-buccet-intercept-server-contract.ts",
    sourceSystemInterceptContract: "contracts/runtime/agent-buccet-system-intercept-contract.ts",
    sourceGravityBridgeContract: "contracts/engines/agent-buccet-gravity-bridge-contract.ts",
    sourceSwarmContract: "contracts/runtime/agent-buccet-swarm-contract.ts",
    sourceHookRuntimeContract: "contracts/runtime/agent-buccet-hook-runtime-contract.ts",
    sourceWrapperContract: "contracts/runtime/agent-buccet-wrapper-contract.ts",
    sourceCliContract: "contracts/cli/agent-buccet-cli-contract.ts",
    sourceInstallContract: "contracts/cli/agent-buccet-install-contract.ts",
    sourceHostedInstallContract: "contracts/cli/agent-buccet-hosted-install-contract.ts",
    sourceReleaseWitnessContract: "contracts/proof/agent-buccet-release-witness-contract.ts",
    sourceWrapperScript: "scripts/agent-buccet-run.ts",
    sourceCliScript: "cli/buccet.ts",
    sourceGravityDaemonScript: "scripts/agent-buccet-gravity-daemon.ts",
    sourceInterceptDaemonScript: "scripts/agent-buccet-intercept-daemon.ts",
    sourceInterceptServerScript: "scripts/agent-buccet-intercept-server.ts",
    sourceGravityBridgeScript: "scripts/agent-buccet-gravity-bridge.ts",
    sourceHookDaemonScript: "scripts/agent-buccet-hook-daemon.ts",
    sourceSystemInterceptBridgeScript: "scripts/agent-buccet-system-intercept-bridge.ts",
    sourceLedgerWriterScript: "scripts/agent-buccet-ledger-writer.ts",
    sourceLedgerCliScript: "scripts/agent-buccet-ledger-cli.ts",
    sourceInstallScript: "scripts/install-agent-buccet.sh",
    sourceHostedInstallScript: "scripts/install-agent-buccet-hosted.sh",
    sourceNativeDir: "native",
    outputDir: "dist/agent-buccet",
    releaseDir: "dist/releases",
    includes: [
      "src/**/*",
      ...packagedDocs.map((relativePath) => path.join("docs", relativePath).split(path.sep).join("/")),
      ...packagedLawFoundationFiles.map((relativePath) =>
        path.join("data", "agent-buccet-law-foundation", relativePath).split(path.sep).join("/")
      ),
      "examples/agent-buccet-e2e.ts",
      "examples/agent-buccet-gravity-e2e.ts",
      "examples/agent-buccet-gravity-contract.ts",
      "examples/agent-buccet-ledger-contract.ts",
      "examples/agent-buccet-ledger-rollup-contract.ts",
      "examples/agent-buccet-ledger-writer-contract.ts",
      "examples/agent-buccet-ledger-witness-contract.ts",
      "examples/agent-buccet-gravity-supervisor-contract.ts",
      "examples/agent-buccet-action-classes-contract.ts",
      "examples/agent-buccet-intercept-daemon-contract.ts",
      "examples/agent-buccet-intercept-server-contract.ts",
      "examples/agent-buccet-system-intercept-contract.ts",
      "examples/agent-buccet-gravity-bridge-contract.ts",
      "examples/agent-buccet-swarm-contract.ts",
      "examples/agent-buccet-hook-runtime-contract.ts",
      "examples/agent-buccet-wrapper-contract.ts",
      "examples/agent-buccet-cli-contract.ts",
      "examples/agent-buccet-install-contract.ts",
      "examples/agent-buccet-hosted-install-contract.ts",
      "examples/agent-buccet-release-witness-contract.ts",
      "bin/agent-buccet-mcp-server.ts",
      "bin/agent-buccet-gravity-daemon.ts",
      "bin/agent-buccet-intercept-daemon.ts",
      "bin/agent-buccet-intercept-server.ts",
      "bin/agent-buccet-gravity-bridge.ts",
      "bin/agent-buccet-hook-daemon.ts",
      "bin/agent-buccet-system-intercept-bridge.ts",
      "bin/agent-buccet-ledger-writer.ts",
      "bin/agent-buccet-ledger-cli.ts",
      "bin/agent-buccet-run.ts",
      "bin/buccet.ts",
      "install.sh",
      "README.md",
      "INSTALL_SNAP.txt",
      "SNAP_INSTALL.json",
      "package.json",
      "tsconfig.json",
      "native/**/*",
      "../releases/install.sh",
      "../releases/latest.json",
      "releases/install.sh",
      "releases/latest.json",
      "releases/agent-buccet-<version>.tar.gz",
    ],
  };
  await fs.writeFile(
    path.join(outDir, "EXTRACTION_MANIFEST.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function writeStandaloneReadme() {
  const sourceReadme = await fs.readFile(path.join(sourceDocsDir, "README.md"), "utf8");
  await fs.writeFile(path.join(outDir, "README.md"), sourceReadme, "utf8");
}

async function writePrebuiltNativeHook() {
  const deepInterceptDir = path.join(outDir, "native", "deep-intercept");
  const buildScriptPath = path.join(deepInterceptDir, "build.sh");
  const packagedBuildDir = path.join(outDir, "native", "build");
  try {
    await mkdirp(packagedBuildDir);
    await runCommand("sh", [buildScriptPath, packagedBuildDir], repoRoot);
  } catch {
    // Prebuilt native hook is a speed optimization, not a packaging requirement.
  }
}

async function writeSnapArtifacts() {
  const process = runBuccetFullSystemBody();
  const summary = buildBuccetInstallSnapSummary(process);
  await fs.writeFile(
    path.join(outDir, "INSTALL_SNAP.txt"),
    `${renderBuccetInstallSnapSummaryText(process)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(outDir, "SNAP_INSTALL.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
}

function rewritePackagedSourceImports(raw: string): string {
  return raw
    .replaceAll("../lib/agent-buccet/", "../src/")
    .replaceAll("./../../src/", "../src/")
    .replaceAll("../../src/", "../src/");
}

async function writeStandaloneExample() {
  const raw = await fs.readFile(sourceExample, "utf8");
  const rewritten = rewritePackagedSourceImports(raw);
  const rawGravity = await fs.readFile(sourceGravityExample, "utf8");
  const rewrittenGravity = rewritePackagedSourceImports(rawGravity);
  const rawGravityContract = await fs.readFile(sourceGravityContract, "utf8");
  const rewrittenGravityContract = rewritePackagedSourceImports(rawGravityContract);
  const rawLedgerContract = await fs.readFile(sourceLedgerContract, "utf8");
  const rewrittenLedgerContract = rewritePackagedSourceImports(rawLedgerContract);
  const rawLedgerRollupContract = await fs.readFile(sourceLedgerRollupContract, "utf8");
  const rewrittenLedgerRollupContract = rewritePackagedSourceImports(rawLedgerRollupContract);
  const rawLedgerWriterContract = await fs.readFile(sourceLedgerWriterContract, "utf8");
  const rewrittenLedgerWriterContract = rewritePackagedSourceImports(rawLedgerWriterContract);
  const rawLedgerWitnessContract = await fs.readFile(sourceLedgerWitnessContract, "utf8");
  const rewrittenLedgerWitnessContract = rewritePackagedSourceImports(rawLedgerWitnessContract);
  const rawGravitySupervisorContract = await fs.readFile(sourceGravitySupervisorContract, "utf8");
  const rewrittenGravitySupervisorContract = rewritePackagedSourceImports(rawGravitySupervisorContract);
  const rawActionClassesContract = await fs.readFile(sourceActionClassesContract, "utf8");
  const rewrittenActionClassesContract = rewritePackagedSourceImports(rawActionClassesContract);
  const rawInterceptDaemonContract = await fs.readFile(sourceInterceptDaemonContract, "utf8");
  const rewrittenInterceptDaemonContract = rewritePackagedSourceImports(rawInterceptDaemonContract);
  const rawInterceptServerContract = await fs.readFile(sourceInterceptServerContract, "utf8");
  const rewrittenInterceptServerContract = rewritePackagedSourceImports(rawInterceptServerContract);
  const rawSystemInterceptContract = await fs.readFile(sourceSystemInterceptContract, "utf8");
  const rewrittenSystemInterceptContract = rewritePackagedSourceImports(rawSystemInterceptContract);
  const rawGravityBridgeContract = await fs.readFile(sourceGravityBridgeContract, "utf8");
  const rewrittenGravityBridgeContract = rewritePackagedSourceImports(rawGravityBridgeContract);
  const rawSwarmContract = await fs.readFile(sourceSwarmContract, "utf8");
  const rewrittenSwarmContract = rewritePackagedSourceImports(rawSwarmContract);
  const rewrittenHookRuntimeContract = rewritePackagedSourceImports(await fs.readFile(sourceHookRuntimeContract, "utf8"));
  const rawWrapperContract = await fs.readFile(sourceWrapperContract, "utf8");
  const rewrittenWrapperContract = rewritePackagedSourceImports(rawWrapperContract);
  const rawCliContract = await fs.readFile(sourceCliContract, "utf8");
  const rewrittenCliContract = rewritePackagedSourceImports(rawCliContract);
  const rewrittenInstallContract = rewritePackagedSourceImports(await fs.readFile(sourceInstallContract, "utf8"));
  const rewrittenHostedInstallContract = rewritePackagedSourceImports(await fs.readFile(sourceHostedInstallContract, "utf8"));
  const rewrittenReleaseWitnessContract = rewritePackagedSourceImports(await fs.readFile(sourceReleaseWitnessContract, "utf8"));
  const examplesDir = path.join(outDir, "examples");
  await mkdirp(examplesDir);
  await fs.writeFile(path.join(examplesDir, "agent-buccet-e2e.ts"), rewritten, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-gravity-e2e.ts"), rewrittenGravity, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-gravity-contract.ts"), rewrittenGravityContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-ledger-contract.ts"), rewrittenLedgerContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-ledger-rollup-contract.ts"), rewrittenLedgerRollupContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-ledger-writer-contract.ts"), rewrittenLedgerWriterContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-ledger-witness-contract.ts"), rewrittenLedgerWitnessContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-gravity-supervisor-contract.ts"), rewrittenGravitySupervisorContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-action-classes-contract.ts"), rewrittenActionClassesContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-intercept-daemon-contract.ts"), rewrittenInterceptDaemonContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-intercept-server-contract.ts"), rewrittenInterceptServerContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-system-intercept-contract.ts"), rewrittenSystemInterceptContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-gravity-bridge-contract.ts"), rewrittenGravityBridgeContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-swarm-contract.ts"), rewrittenSwarmContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-hook-runtime-contract.ts"), rewrittenHookRuntimeContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-wrapper-contract.ts"), rewrittenWrapperContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-cli-contract.ts"), rewrittenCliContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-install-contract.ts"), rewrittenInstallContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-hosted-install-contract.ts"), rewrittenHostedInstallContract, "utf8");
  await fs.writeFile(path.join(examplesDir, "agent-buccet-release-witness-contract.ts"), rewrittenReleaseWitnessContract, "utf8");
}

async function writeStandaloneWrapper() {
  const raw = await fs.readFile(sourceWrapperScript, "utf8");
  const rewritten = rewritePackagedSourceImports(raw);
  const binDir = path.join(outDir, "bin");
  await mkdirp(binDir);
  await fs.writeFile(path.join(binDir, "agent-buccet-run.ts"), rewritten, "utf8");

  const rawGravityDaemon = await fs.readFile(sourceGravityDaemonScript, "utf8");
  const rewrittenGravityDaemon = rewritePackagedSourceImports(rawGravityDaemon);
  await fs.writeFile(path.join(binDir, "agent-buccet-gravity-daemon.ts"), rewrittenGravityDaemon, "utf8");

  const rawInterceptDaemon = await fs.readFile(sourceInterceptDaemonScript, "utf8");
  const rewrittenInterceptDaemon = rewritePackagedSourceImports(rawInterceptDaemon);
  await fs.writeFile(path.join(binDir, "agent-buccet-intercept-daemon.ts"), rewrittenInterceptDaemon, "utf8");

  const rawInterceptServer = await fs.readFile(sourceInterceptServerScript, "utf8");
  const rewrittenInterceptServer = rewritePackagedSourceImports(rawInterceptServer);
  await fs.writeFile(path.join(binDir, "agent-buccet-intercept-server.ts"), rewrittenInterceptServer, "utf8");

  const rawGravityBridge = await fs.readFile(sourceGravityBridgeScript, "utf8");
  const rewrittenGravityBridge = rewritePackagedSourceImports(rawGravityBridge);
  await fs.writeFile(path.join(binDir, "agent-buccet-gravity-bridge.ts"), rewrittenGravityBridge, "utf8");

  const rawHookDaemon = await fs.readFile(sourceHookDaemonScript, "utf8");
  await fs.writeFile(path.join(binDir, "agent-buccet-hook-daemon.ts"), rawHookDaemon, "utf8");

  const rawSystemInterceptBridge = await fs.readFile(sourceSystemInterceptBridgeScript, "utf8");
  const rewrittenSystemInterceptBridge = rewritePackagedSourceImports(rawSystemInterceptBridge);
  await fs.writeFile(path.join(binDir, "agent-buccet-system-intercept-bridge.ts"), rewrittenSystemInterceptBridge, "utf8");

  const rawLedgerWriter = await fs.readFile(sourceLedgerWriterScript, "utf8");
  const rewrittenLedgerWriter = rewritePackagedSourceImports(rawLedgerWriter);
  await fs.writeFile(path.join(binDir, "agent-buccet-ledger-writer.ts"), rewrittenLedgerWriter, "utf8");

  const rawLedgerCli = await fs.readFile(sourceLedgerCliScript, "utf8");
  const rewrittenLedgerCli = rewritePackagedSourceImports(rawLedgerCli);
  await fs.writeFile(path.join(binDir, "agent-buccet-ledger-cli.ts"), rewrittenLedgerCli, "utf8");

  const rawCli = await fs.readFile(sourceCliScript, "utf8");
  const rewrittenCli = rewritePackagedSourceImports(rawCli);
  await fs.writeFile(path.join(binDir, "buccet.ts"), rewrittenCli, "utf8");

  const rawMcpServer = await fs.readFile(sourceMcpServerScript, "utf8");
  const rewrittenMcpServer = rewritePackagedSourceImports(rawMcpServer);
  await fs.writeFile(path.join(binDir, "agent-buccet-mcp-server.ts"), rewrittenMcpServer, "utf8");

  const rawInstall = await fs.readFile(sourceInstallScript, "utf8");
  await fs.writeFile(path.join(outDir, "install.sh"), rawInstall, "utf8");
  await fs.chmod(path.join(outDir, "install.sh"), 0o755);
}

async function writeHostedInstaller() {
  await mkdirp(releaseDir);
  const raw = await fs.readFile(sourceHostedInstallScript, "utf8");
  await fs.writeFile(path.join(releaseDir, "install.sh"), raw, "utf8");
  await fs.chmod(path.join(releaseDir, "install.sh"), 0o755);
}

async function writeReleaseArtifacts(version: string, witness: BoundaryReleaseWitnessStatus) {
  await mkdirp(releaseDir);
  const packagedReleaseDir = path.join(outDir, "releases");
  await mkdirp(packagedReleaseDir);
  const archiveBaseName = `agent-buccet-${version}`;
  const archiveFileName = `${archiveBaseName}.tar.gz`;
  const archivePath = path.join(releaseDir, archiveFileName);

  await runCommand("tar", ["-czf", archivePath, "-C", path.dirname(outDir), path.basename(outDir)], repoRoot);

  const archiveBuffer = await fs.readFile(archivePath);
  const sha256 = createHash("sha256").update(archiveBuffer).digest("hex");

  const manifest = {
    project: "agent-buccet",
    version,
    generatedAt: new Date().toISOString(),
    archive: archiveFileName,
    sha256,
    witness,
  };

  await fs.writeFile(
    path.join(releaseDir, `${version}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(releaseDir, "latest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(path.join(releaseDir, `${archiveFileName}.sha256`), `${sha256}  ${archiveFileName}\n`, "utf8");

  const hostedInstallerPath = path.join(releaseDir, "install.sh");
  const versionManifestPath = path.join(releaseDir, `${version}.json`);
  const latestManifestPath = path.join(releaseDir, "latest.json");
  const checksumPath = path.join(releaseDir, `${archiveFileName}.sha256`);

  await fs.copyFile(hostedInstallerPath, path.join(packagedReleaseDir, "install.sh"));
  await fs.copyFile(versionManifestPath, path.join(packagedReleaseDir, `${version}.json`));
  await fs.copyFile(latestManifestPath, path.join(packagedReleaseDir, "latest.json"));
  await fs.copyFile(archivePath, path.join(packagedReleaseDir, archiveFileName));
  await fs.copyFile(checksumPath, path.join(packagedReleaseDir, `${archiveFileName}.sha256`));
}

async function main() {
  const skipVerification = process.env.AGENT_BUCCET_PACKAGE_SKIP_VERIFY === "1";
  const version = await readPackageVersion();
  await runCommand("node", ["scripts/render-agent-buccet-runtime-snaps.ts"], repoRoot);
  const inputHash = await computePackageInputHash();
  if (await packageArtifactsAreFresh(inputHash, version)) {
    console.log(`Agent Buccet package already current at ${outDir}`);
    console.log(`Agent Buccet release artifacts already current at ${releaseDir}`);
    return;
  }
  if (!skipVerification) {
    await runCommand("npm", ["run", "test:agent-buccet:doc-links"], repoRoot);
    await runCommand("npm", ["run", "test:agent-buccet:artifact-hygiene"], repoRoot);
    await runCommand("npm", ["run", "check:agent-buccet:contracts-stable"], repoRoot);
    await runCommand("npm", ["run", "test:agent-buccet:release-witness"], repoRoot);
  }

  await rmrf(outDir);
  await rmrf(releaseDir);
  await mkdirp(outDir);
  await copyDir(sourceRuntimeDir, path.join(outDir, "src"));
  await rmrf(path.join(outDir, "src", "full-system-body.ts"));
  await rmrf(path.join(outDir, "src", "system-substrate.ts"));
  for (const relativeDocPath of packagedDocs) {
    await copyRelativePath(sourceDocsDir, relativeDocPath, path.join(outDir, "docs"));
  }
  for (const relativePath of packagedLawFoundationFiles) {
    await copyRelativePath(
      sourceLawFoundationDir,
      relativePath,
      path.join(outDir, "data", "agent-buccet-law-foundation"),
    );
  }
  await copyDir(sourceNativeDir, path.join(outDir, "native"));
  await writePrebuiltNativeHook();
  await writeStandaloneExample();
  await writeStandaloneWrapper();
  await writeStandalonePackageJson();
  await writeStandaloneTsconfig();
  await writeStandaloneReadme();
  await writeSnapArtifacts();
  await writeExtractionManifest();
  await writeHostedInstaller();
  const witness = await publishBoundaryReleaseWitness({ releaseDir, env: process.env });
  await writeReleaseArtifacts(version, witness);
  await writePackageBuildState(inputHash, version);
  console.log(`Prepared Agent Buccet standalone package at ${outDir}`);
  console.log(`Prepared Agent Buccet release artifacts at ${releaseDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
