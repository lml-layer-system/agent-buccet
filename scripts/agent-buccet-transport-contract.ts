import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();

function run(command: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
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
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-transport-contract-"));
  try {
    const appDir = path.join(tempRoot, "portable-app");
    await fs.mkdir(appDir, { recursive: true });
    await fs.writeFile(path.join(appDir, "payload.txt"), "portable-hello\n", "utf8");
    await fs.writeFile(
      path.join(appDir, "index.mjs"),
      [
        'import { readFileSync } from "node:fs";',
        'const payload = readFileSync("payload.txt", "utf8").trim();',
        'console.log(`TRANSPORT_PAYLOAD=${payload}`);',
        'console.log(`TRANSPORT_CWD=${process.cwd()}`);',
      ].join("\n"),
      "utf8",
    );

    const artifactPath = path.join(tempRoot, "portable-app.buccet.tgz");
    const packResult = await run(
      "node",
      [
        "scripts/buccet.ts",
        "transport",
        "pack",
        appDir,
        "--output",
        artifactPath,
        "--json",
        "--",
        "node",
        "index.mjs",
      ],
      repoRoot,
    );
    assert.equal(packResult.code, 0, packResult.stderr);
    const packed = JSON.parse(packResult.stdout) as {
      artifactPath: string;
      manifest: { fileCount: number; entrypoint: string[] };
    };
    assert.equal(packed.artifactPath, artifactPath);
    assert.equal(packed.manifest.fileCount >= 2, true, "expected packaged app files");
    assert.deepEqual(packed.manifest.entrypoint, ["node", "index.mjs"]);

    const importedDir = path.join(tempRoot, "imported-app");
    const importResult = await run(
      "node",
      [
        "scripts/buccet.ts",
        "transport",
        "import",
        artifactPath,
        "--into",
        importedDir,
        "--json",
      ],
      repoRoot,
    );
    assert.equal(importResult.code, 0, importResult.stderr);
    const imported = JSON.parse(importResult.stdout) as {
      destinationDir: string;
      rootfsPath: string;
      manifest: { name: string; entrypoint: string[] };
    };
    assert.equal(imported.destinationDir, importedDir);
    assert.equal(imported.rootfsPath, path.join(importedDir, "rootfs"));
    assert.deepEqual(imported.manifest.entrypoint, ["node", "index.mjs"]);

    const runResult = await run(
      "node",
      [
        "scripts/buccet.ts",
        "transport",
        "run",
        artifactPath,
      ],
      repoRoot,
    );
    assert.equal(runResult.code, 0, runResult.stderr);
    assert.equal(runResult.stdout.includes("TRANSPORT_PAYLOAD=portable-hello"), true, "expected packaged payload to execute");
    assert.equal(runResult.stdout.includes("entered environment: yes"), true, "expected transport run to stage environment");

    console.log("Agent Buccet transport contract");
    console.log(`artifact: ${artifactPath}`);
    console.log(`imported dir: ${importedDir}`);
    console.log("portable run: ok");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
