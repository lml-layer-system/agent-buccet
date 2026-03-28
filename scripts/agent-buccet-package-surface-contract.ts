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

  console.log("Agent Buccet package surface contract");
  console.log("  root README install claim: truthful");
  console.log("  standalone package: publishable metadata present");
  console.log("  buccet bin: wired");
  console.log("  release shell: present");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
