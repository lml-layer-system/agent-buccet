/**
 * CLAUDE RED-TEAM (decision layer) — sensitive-target classifier (AUTH-01).
 *
 * Silo: policy decisions. Autonomous mode follows standing UPL with no human,
 * so a broad workspace corridor also auto-authorizes secret/credential files
 * beneath it. isSensitiveMutationTarget lets the follow_upl handler hold those
 * for a human instead. This proves the classifier flags credential material and
 * leaves ordinary work files alone (no false positives that would break
 * legitimate autonomous operation).
 */
import assert from "node:assert/strict";
import { isSensitiveMutationTarget } from "./../../src/law/sensitive-target.ts";

async function main() {
  // Sensitive mutations that autonomous must NOT silently auto-allow.
  for (const t of [
    "/ws/project/.env",
    "/ws/project/.env.production",
    "/home/u/.ssh/authorized_keys",
    "/home/u/.aws/credentials",
    "/ws/.git/config",
    "/ws/deploy/server.pem",
    "/ws/certs/key.p12",
    "/home/u/.npmrc",
    "/home/u/.gnupg/secring.gpg",
  ]) {
    assert.equal(isSensitiveMutationTarget("fs.write", t), true, `must flag sensitive write: ${t}`);
  }
  assert.equal(
    isSensitiveMutationTarget("fs.delete", "/ws/project/.env"),
    true,
    "delete of a secret is sensitive",
  );
  assert.equal(
    isSensitiveMutationTarget("fs.move", "/home/u/.ssh/id_ed25519"),
    true,
    "move of a key is sensitive",
  );

  // Ordinary work files must NOT be flagged — otherwise autonomous breaks.
  for (const t of [
    "/ws/project/report.txt",
    "/ws/project/src/index.ts",
    "/ws/project/README.md",
    "/ws/project/data/notes.env.md", // not a dotenv file
    "/ws/environment.txt",
  ]) {
    assert.equal(
      isSensitiveMutationTarget("fs.write", t),
      false,
      `must NOT flag ordinary file: ${t}`,
    );
  }

  // Reads are not the over-trust concern here; only mutations are held.
  assert.equal(
    isSensitiveMutationTarget("fs.read", "/ws/project/.env"),
    false,
    "reads are out of scope for this hold",
  );
  // Non-fs mutation of credential/env surfaces is sensitive.
  assert.equal(isSensitiveMutationTarget("sys.env.write", "ANY"), true, "env writes are sensitive");

  console.log(
    "sensitive-target: credential material flagged, ordinary files clear, reads excluded",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
