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
    const binDir = path.join(appDir, "bin");
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(appDir, "payload.txt"), "portable-hello\n", "utf8");
    const sourcePath = path.join(tempRoot, "portable-app.c");
    await fs.writeFile(
      sourcePath,
      [
        "#include <stdio.h>",
        "#include <stdlib.h>",
        "int main(void) {",
        '  FILE *fp = fopen("payload.txt", "r");',
        "  if (!fp) {",
        '    perror("payload");',
        "    return 1;",
        "  }",
        "  char buffer[128] = {0};",
        "  if (!fgets(buffer, sizeof(buffer), fp)) {",
        '    perror("read");',
        "    fclose(fp);",
        "    return 1;",
        "  }",
        "  fclose(fp);",
        '  printf("TRANSPORT_PAYLOAD=%s", buffer);',
        '  printf("TRANSPORT_EXEC=packaged-binary\\n");',
        "  return 0;",
        "}",
      ].join("\n"),
      "utf8",
    );
    const binaryPath = path.join(binDir, "portable-app");
    const compileResult = await run("cc", [sourcePath, "-o", binaryPath], repoRoot);
    assert.equal(compileResult.code, 0, compileResult.stderr);

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
        "--workdir",
        "/",
        "--json",
        "--",
        "/bin/portable-app",
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
    assert.deepEqual(packed.manifest.entrypoint, ["/bin/portable-app"]);

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
    assert.deepEqual(imported.manifest.entrypoint, ["/bin/portable-app"]);

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
    assert.equal(runResult.stdout.includes("TRANSPORT_EXEC=packaged-binary"), true, "expected transport run to use packaged binary");
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
