import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { publishBoundaryReleaseWitness, type BoundaryReleaseWitnessStatus } from "../lib/agent-buccet/index.ts";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, "dist", "agent-buccet");
const releaseDir = path.join(repoRoot, "dist", "releases");
const sourceRuntimeDir = path.join(repoRoot, "lib", "agent-buccet");
const sourceDocsDir = path.join(repoRoot, "docs", "agent-boundary");
const sourceLawFoundationDir = path.join(repoRoot, "data", "agent-buccet-law-foundation");
const sourceExample = path.join(repoRoot, "scripts", "agent-buccet-e2e.ts");
const sourceGravityExample = path.join(repoRoot, "scripts", "agent-buccet-gravity-e2e.ts");
const sourceGravityContract = path.join(repoRoot, "scripts", "agent-buccet-gravity-contract.ts");
const sourceLedgerContract = path.join(repoRoot, "scripts", "agent-buccet-ledger-contract.ts");
const sourceLedgerRollupContract = path.join(repoRoot, "scripts", "agent-buccet-ledger-rollup-contract.ts");
const sourceLedgerWriterContract = path.join(repoRoot, "scripts", "agent-buccet-ledger-writer-contract.ts");
const sourceLedgerWitnessContract = path.join(repoRoot, "scripts", "agent-buccet-ledger-witness-contract.ts");
const sourceGravitySupervisorContract = path.join(repoRoot, "scripts", "agent-buccet-gravity-supervisor-contract.ts");
const sourceActionClassesContract = path.join(repoRoot, "scripts", "agent-buccet-action-classes-contract.ts");
const sourceInterceptDaemonContract = path.join(repoRoot, "scripts", "agent-buccet-intercept-daemon-contract.ts");
const sourceInterceptServerContract = path.join(repoRoot, "scripts", "agent-buccet-intercept-server-contract.ts");
const sourceSystemInterceptContract = path.join(repoRoot, "scripts", "agent-buccet-system-intercept-contract.ts");
const sourceGravityBridgeContract = path.join(repoRoot, "scripts", "agent-buccet-gravity-bridge-contract.ts");
const sourceSwarmContract = path.join(repoRoot, "scripts", "agent-buccet-swarm-contract.ts");
const sourceHookRuntimeContract = path.join(repoRoot, "scripts", "agent-buccet-hook-runtime-contract.ts");
const sourceWrapperContract = path.join(repoRoot, "scripts", "agent-buccet-wrapper-contract.ts");
const sourceCliContract = path.join(repoRoot, "scripts", "agent-buccet-cli-contract.ts");
const sourceInstallContract = path.join(repoRoot, "scripts", "agent-buccet-install-contract.ts");
const sourceHostedInstallContract = path.join(repoRoot, "scripts", "agent-buccet-hosted-install-contract.ts");
const sourceReleaseWitnessContract = path.join(repoRoot, "scripts", "agent-buccet-release-witness-contract.ts");
const sourceWrapperScript = path.join(repoRoot, "scripts", "agent-buccet-run.ts");
const sourceCliScript = path.join(repoRoot, "scripts", "buccet.ts");
const sourceGravityDaemonScript = path.join(repoRoot, "scripts", "agent-buccet-gravity-daemon.ts");
const sourceInterceptDaemonScript = path.join(repoRoot, "scripts", "agent-buccet-intercept-daemon.ts");
const sourceInterceptServerScript = path.join(repoRoot, "scripts", "agent-buccet-intercept-server.ts");
const sourceGravityBridgeScript = path.join(repoRoot, "scripts", "agent-buccet-gravity-bridge.ts");
const sourceHookDaemonScript = path.join(repoRoot, "scripts", "agent-buccet-hook-daemon.ts");
const sourceSystemInterceptBridgeScript = path.join(repoRoot, "scripts", "agent-buccet-system-intercept-bridge.ts");
const sourceLedgerWriterScript = path.join(repoRoot, "scripts", "agent-buccet-ledger-writer.ts");
const sourceLedgerCliScript = path.join(repoRoot, "scripts", "agent-buccet-ledger-cli.ts");
const sourceInstallScript = path.join(repoRoot, "scripts", "install-agent-buccet.sh");
const sourceHostedInstallScript = path.join(repoRoot, "scripts", "install-agent-buccet-hosted.sh");
const sourceNativeDir = path.join(repoRoot, "native");

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

async function readPackageVersion(): Promise<string> {
  const raw = await fs.readFile(path.join(repoRoot, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.1.0";
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
    sourceRuntimeDir: "lib/agent-buccet",
    sourceDocsDir: "docs/agent-boundary",
    sourceLawFoundationDir: "data/agent-buccet-law-foundation",
    sourceExample: "scripts/agent-buccet-e2e.ts",
    sourceGravityExample: "scripts/agent-buccet-gravity-e2e.ts",
    sourceGravityContract: "scripts/agent-buccet-gravity-contract.ts",
    sourceLedgerContract: "scripts/agent-buccet-ledger-contract.ts",
    sourceLedgerRollupContract: "scripts/agent-buccet-ledger-rollup-contract.ts",
    sourceLedgerWriterContract: "scripts/agent-buccet-ledger-writer-contract.ts",
    sourceLedgerWitnessContract: "scripts/agent-buccet-ledger-witness-contract.ts",
    sourceGravitySupervisorContract: "scripts/agent-buccet-gravity-supervisor-contract.ts",
    sourceActionClassesContract: "scripts/agent-buccet-action-classes-contract.ts",
    sourceInterceptDaemonContract: "scripts/agent-buccet-intercept-daemon-contract.ts",
    sourceInterceptServerContract: "scripts/agent-buccet-intercept-server-contract.ts",
    sourceSystemInterceptContract: "scripts/agent-buccet-system-intercept-contract.ts",
    sourceGravityBridgeContract: "scripts/agent-buccet-gravity-bridge-contract.ts",
    sourceSwarmContract: "scripts/agent-buccet-swarm-contract.ts",
    sourceHookRuntimeContract: "scripts/agent-buccet-hook-runtime-contract.ts",
    sourceWrapperContract: "scripts/agent-buccet-wrapper-contract.ts",
    sourceCliContract: "scripts/agent-buccet-cli-contract.ts",
    sourceInstallContract: "scripts/agent-buccet-install-contract.ts",
    sourceHostedInstallContract: "scripts/agent-buccet-hosted-install-contract.ts",
    sourceReleaseWitnessContract: "scripts/agent-buccet-release-witness-contract.ts",
    sourceWrapperScript: "scripts/agent-buccet-run.ts",
    sourceCliScript: "scripts/buccet.ts",
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
      "docs/**/*",
      "data/agent-buccet-law-foundation/**/*",
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

async function writeStandaloneExample() {
  const raw = await fs.readFile(sourceExample, "utf8");
  const rewritten = raw.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawGravity = await fs.readFile(sourceGravityExample, "utf8");
  const rewrittenGravity = rawGravity.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawGravityContract = await fs.readFile(sourceGravityContract, "utf8");
  const rewrittenGravityContract = rawGravityContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawLedgerContract = await fs.readFile(sourceLedgerContract, "utf8");
  const rewrittenLedgerContract = rawLedgerContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawLedgerRollupContract = await fs.readFile(sourceLedgerRollupContract, "utf8");
  const rewrittenLedgerRollupContract = rawLedgerRollupContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawLedgerWriterContract = await fs.readFile(sourceLedgerWriterContract, "utf8");
  const rewrittenLedgerWriterContract = rawLedgerWriterContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawLedgerWitnessContract = await fs.readFile(sourceLedgerWitnessContract, "utf8");
  const rewrittenLedgerWitnessContract = rawLedgerWitnessContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawGravitySupervisorContract = await fs.readFile(sourceGravitySupervisorContract, "utf8");
  const rewrittenGravitySupervisorContract = rawGravitySupervisorContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawActionClassesContract = await fs.readFile(sourceActionClassesContract, "utf8");
  const rewrittenActionClassesContract = rawActionClassesContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawInterceptDaemonContract = await fs.readFile(sourceInterceptDaemonContract, "utf8");
  const rewrittenInterceptDaemonContract = rawInterceptDaemonContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawInterceptServerContract = await fs.readFile(sourceInterceptServerContract, "utf8");
  const rewrittenInterceptServerContract = rawInterceptServerContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawSystemInterceptContract = await fs.readFile(sourceSystemInterceptContract, "utf8");
  const rewrittenSystemInterceptContract = rawSystemInterceptContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawGravityBridgeContract = await fs.readFile(sourceGravityBridgeContract, "utf8");
  const rewrittenGravityBridgeContract = rawGravityBridgeContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawSwarmContract = await fs.readFile(sourceSwarmContract, "utf8");
  const rewrittenSwarmContract = rawSwarmContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rewrittenHookRuntimeContract = await fs.readFile(sourceHookRuntimeContract, "utf8");
  const rawWrapperContract = await fs.readFile(sourceWrapperContract, "utf8");
  const rewrittenWrapperContract = rawWrapperContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rawCliContract = await fs.readFile(sourceCliContract, "utf8");
  const rewrittenCliContract = rawCliContract.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const rewrittenInstallContract = await fs.readFile(sourceInstallContract, "utf8");
  const rewrittenHostedInstallContract = await fs.readFile(sourceHostedInstallContract, "utf8");
  const rewrittenReleaseWitnessContract = await fs.readFile(sourceReleaseWitnessContract, "utf8");
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
  const rewritten = raw.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  const binDir = path.join(outDir, "bin");
  await mkdirp(binDir);
  await fs.writeFile(path.join(binDir, "agent-buccet-run.ts"), rewritten, "utf8");

  const rawGravityDaemon = await fs.readFile(sourceGravityDaemonScript, "utf8");
  const rewrittenGravityDaemon = rawGravityDaemon.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "agent-buccet-gravity-daemon.ts"), rewrittenGravityDaemon, "utf8");

  const rawInterceptDaemon = await fs.readFile(sourceInterceptDaemonScript, "utf8");
  const rewrittenInterceptDaemon = rawInterceptDaemon.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "agent-buccet-intercept-daemon.ts"), rewrittenInterceptDaemon, "utf8");

  const rawInterceptServer = await fs.readFile(sourceInterceptServerScript, "utf8");
  const rewrittenInterceptServer = rawInterceptServer.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "agent-buccet-intercept-server.ts"), rewrittenInterceptServer, "utf8");

  const rawGravityBridge = await fs.readFile(sourceGravityBridgeScript, "utf8");
  const rewrittenGravityBridge = rawGravityBridge.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "agent-buccet-gravity-bridge.ts"), rewrittenGravityBridge, "utf8");

  const rawHookDaemon = await fs.readFile(sourceHookDaemonScript, "utf8");
  await fs.writeFile(path.join(binDir, "agent-buccet-hook-daemon.ts"), rawHookDaemon, "utf8");

  const rawSystemInterceptBridge = await fs.readFile(sourceSystemInterceptBridgeScript, "utf8");
  const rewrittenSystemInterceptBridge = rawSystemInterceptBridge.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "agent-buccet-system-intercept-bridge.ts"), rewrittenSystemInterceptBridge, "utf8");

  const rawLedgerWriter = await fs.readFile(sourceLedgerWriterScript, "utf8");
  const rewrittenLedgerWriter = rawLedgerWriter.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "agent-buccet-ledger-writer.ts"), rewrittenLedgerWriter, "utf8");

  const rawLedgerCli = await fs.readFile(sourceLedgerCliScript, "utf8");
  const rewrittenLedgerCli = rawLedgerCli.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "agent-buccet-ledger-cli.ts"), rewrittenLedgerCli, "utf8");

  const rawCli = await fs.readFile(sourceCliScript, "utf8");
  const rewrittenCli = rawCli.replaceAll(
    "../lib/agent-buccet/",
    "../src/",
  );
  await fs.writeFile(path.join(binDir, "buccet.ts"), rewrittenCli, "utf8");

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
  await runCommand("npm", ["run", "test:agent-buccet:doc-links"], repoRoot);
  await runCommand("npm", ["run", "test:agent-buccet:artifact-hygiene"], repoRoot);
  await runCommand("npm", ["run", "check:agent-buccet:contracts-stable"], repoRoot);
  await runCommand("npm", ["run", "test:agent-buccet:release-witness"], repoRoot);

  const version = await readPackageVersion();
  await rmrf(outDir);
  await rmrf(releaseDir);
  await mkdirp(outDir);
  await copyDir(sourceRuntimeDir, path.join(outDir, "src"));
  await copyDir(sourceDocsDir, path.join(outDir, "docs"));
  await copyDir(sourceLawFoundationDir, path.join(outDir, "data", "agent-buccet-law-foundation"));
  await copyDir(sourceNativeDir, path.join(outDir, "native"));
  await writeStandaloneExample();
  await writeStandaloneWrapper();
  await writeStandalonePackageJson();
  await writeStandaloneTsconfig();
  await writeStandaloneReadme();
  await writeExtractionManifest();
  await writeHostedInstaller();
  const witness = await publishBoundaryReleaseWitness({ releaseDir, env: process.env });
  await writeReleaseArtifacts(version, witness);
  console.log(`Prepared Agent Buccet standalone package at ${outDir}`);
  console.log(`Prepared Agent Buccet release artifacts at ${releaseDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
