import assert from "node:assert/strict";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  appendBoundaryLedger,
  publishBoundaryReleaseWitness,
} from "./../../src/index.ts";

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-release-witness-"));
  const releaseDir = path.join(tempRoot, "dist", "releases");
  await fs.mkdir(releaseDir, { recursive: true });
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    await appendBoundaryLedger("ACTION_PROPOSED", {
      sessionId: "agent-buccet-release-witness",
      actorId: "system:release-witness-contract",
      requestId: "release-witness-contract",
      actionKind: "fs.read",
      target: "/tmp/release-witness.txt",
      reason: "create checkpointable ledger record",
      createdAt: new Date().toISOString(),
    });

    const published = await publishBoundaryReleaseWitness({
      releaseDir,
      env: {
        ...process.env,
      },
    });
    assert.equal(published.status, "published");
    assert.equal(published.mode, "file");
    assert.equal(typeof published.checkpoint_id, "string");

    const statusPath = path.join(releaseDir, "witness", "status.json");
    const status = JSON.parse(await fs.readFile(statusPath, "utf8")) as { status?: string; checkpoint_id?: string };
    assert.equal(status.status, "published");
    assert.equal(status.checkpoint_id, published.checkpoint_id);

    // HTTP witness mode coverage: publish a release witness via an HTTP POST endpoint.
    const httpRequests: string[] = [];
    const server = http.createServer((req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end();
        return;
      }

      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        httpRequests.push(body);
        try {
          const json = JSON.parse(body) as { checkpoint_id?: string; signer_id?: string };
          assert.equal(typeof json.checkpoint_id, "string");
          assert.equal(typeof json.signer_id, "string");
        } catch (e) {
          res.statusCode = 400;
          res.end(String(e));
          return;
        }

        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    assert.ok(address && typeof address === "object");
    const port = address.port;
    const httpUrl = `http://127.0.0.1:${port}/witness`;

    const publishedHttp = await publishBoundaryReleaseWitness({
      releaseDir,
      env: {
        ...process.env,
        AGENT_BUCCET_WITNESS_REQUIRED: "true",
        AGENT_BUCCET_WITNESS_HTTP_URL: httpUrl,
      },
    });

    assert.equal(publishedHttp.status, "published");
    assert.equal(publishedHttp.mode, "http");
    assert.equal(publishedHttp.target, httpUrl);
    assert.equal(typeof publishedHttp.checkpoint_id, "string");

    const httpStatus = JSON.parse(await fs.readFile(statusPath, "utf8")) as {
      status?: string;
      checkpoint_id?: string;
      mode?: string;
      target?: string;
    };
    assert.equal(httpStatus.status, "published");
    assert.equal(httpStatus.mode, "http");
    assert.equal(httpStatus.target, httpUrl);
    assert.equal(httpStatus.checkpoint_id, publishedHttp.checkpoint_id);
    assert.equal(httpRequests.length, 1);

    await new Promise<void>((resolve) => server.close(() => resolve()));

    let threw = false;
    try {
      await publishBoundaryReleaseWitness({
        releaseDir,
        env: {
          ...process.env,
          AGENT_BUCCET_WITNESS_REQUIRED: "false",
        },
      });
    } catch (error) {
      threw = true;
      assert.match(String(error), /OPT_OUT_REASON/);
    }
    assert.equal(threw, true);

    const skipped = await publishBoundaryReleaseWitness({
      releaseDir,
      env: {
        ...process.env,
        AGENT_BUCCET_WITNESS_REQUIRED: "false",
        AGENT_BUCCET_WITNESS_OPT_OUT_REASON: "contract break-glass path",
      },
    });
    assert.equal(skipped.status, "skipped");
    assert.equal(skipped.opt_out_reason, "contract break-glass path");

    const skippedStatus = JSON.parse(await fs.readFile(statusPath, "utf8")) as { status?: string; opt_out_reason?: string };
    assert.equal(skippedStatus.status, "skipped");
    assert.equal(skippedStatus.opt_out_reason, "contract break-glass path");

    console.log("Agent Buccet release witness contract");
    console.log(`published checkpoint: ${published.checkpoint_id}`);
    console.log(`published target: ${published.target}`);
    console.log("opt-out guardrail: ok");
  } finally {
    process.chdir(previousCwd);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
