#!/usr/bin/env node
/**
 * Frontier03 EVIDENCE FENCE — policy preflight, NOT an adversarial test.
 *
 * Initial 0/10 state is valid to PREPARE but never valid for RELEASE.
 * A green gate requires verified GitHub run + job + exact SHA + artifacts
 * for BOTH the real-effect attack and legitimate authorized operation.
 *
 * This script does not prove that a test truly reached the security boundary:
 * runtime suites and reviewed evidence establish that. It makes unsupported,
 * stale, skipped, missing, or merely self-asserted green states fail closed.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const release = process.argv.includes("--release");
const filename = process.argv.find(x => x.endsWith(".json")) ??
  "contracts/security/frontier03-acceptance.json";
const REPO = "lml-layer-system/agent-buccet";
const SCHEMA = "agent-buccet/frontier03-acceptance-v1";
const IDS = Array.from({ length: 10 }, (_, i) => "G" + String(i + 1).padStart(2, "0"));
const EXPECTED_PLATFORMS = {
  G01: ["linux"], G02: ["linux"], G03: ["linux"], G04: ["linux"],
  G05: ["linux"], G06: ["linux"], G07: ["macos"], G08: ["windows"],
  G09: ["linux", "macos", "windows"],
  G10: ["linux", "macos", "windows"],
};
const SHA = /^[a-f0-9]{40}$/;
const failures = [];
const fail = (why) => failures.push(why);
const isObject = x => x !== null && typeof x === "object" &&
  !Array.isArray(x);
const safeText = (x, len = 48) => typeof x === "string" &&
  x.trim().length >= len && x.length <= 4096;
const isPositiveInteger = x => Number.isSafeInteger(x) && x > 0;

let policy;
try {
  policy = JSON.parse(readFileSync(filename, "utf8"));
} catch (error) {
  console.error("FRONTIER_FENCE_DENIED: cannot read strict policy", String(error));
  process.exit(73);
}

if (!isObject(policy) || policy.schema !== SCHEMA ||
    policy.repo !== REPO || policy.targetGateCount !== 10) {
  fail("manifest schema/repository/10-gate count cannot be changed");
}
if (!policy?.baseline?.baselineDoesNotProveNewGates ||
    policy.baseline.mergedPr !== 18 ||
    !SHA.test(policy.baseline.mainCommitAtCreation ?? "")) {
  fail("prior PR #18 must remain baseline evidence only");
}
if (!policy?.releasePolicy?.positiveAndNegativeEvidenceRequired ||
    !policy.releasePolicy.rejectUnknownSkippedOrUnsupportedAsPass ||
    !policy.releasePolicy.prohibitInheritedBaselineEvidence ||
    !policy.releasePolicy.requireExactSourceCommit ||
    !policy.releasePolicy.requireCurrentUnexpiredArtifactDigests ||
    !policy.releasePolicy.requireSameRunAttackAndPositiveControl ||
    !policy.releasePolicy.rejectTestOnlyInsecureBuildAsProductionProof ||
    !policy.releasePolicy.rejectUnboundStatusClaims ||
    !policy.releasePolicy.requireIssueCheckboxConsistency) {
  fail("a release-lock invariant was removed or disabled");
}
if (!Array.isArray(policy.gates) || policy.gates.length !== 10) {
  fail("exactly ten individually closed gates required");
}
const gates = Array.isArray(policy.gates) ? policy.gates : [];
let totalEffort = 0;
const claimed = [];
for (let i = 0; i < 10; ++i) {
  const gate = gates[i];
  const id = IDS[i];
  if (!isObject(gate) || gate.id !== id) {
    fail("gate " + id + " missing, reordered or renamed");
    continue;
  }
  const correctIssue = 22 + Math.floor(i / 2);
  if (gate.issue !== correctIssue ||
      gate.platform !== (i === 6 ? "macos" : i === 7 ? "windows" :
        i >= 8 ? "cross-platform" : "linux") ||
      !Array.isArray(gate.mustProve) || gate.mustProve.length < 4 ||
      gate.mustProve.some(x => !safeText(x, 8)) ||
      !safeText(gate.failureClass, 8) ||
      !safeText(gate.invariant, 20) ||
      gate.expectedJob !== "Frontier03 / " + id + " evidence") {
    fail(id + " changed pinned class, scope, minimum obligations, or CI job");
  }
  if (!Number.isInteger(gate.estimatedEffortPct) ||
      gate.estimatedEffortPct < 0 || gate.estimatedEffortPct > 30) {
    fail(id + " must have an explicitly estimated nonnegative work share");
  } else {
    totalEffort += gate.estimatedEffortPct;
  }
  if (gate.state === "UNVERIFIED") {
    if (gate.evidence !== null) fail(id + " has unverified status but nonempty evidence");
  } else if (gate.state === "GREEN") {
    claimed.push(gate);
    const ev = gate.evidence;
    if (!isObject(ev) ||
        !safeText(ev.threatModel, 30) ||
        !safeText(ev.rootCause, 30) ||
        !safeText(ev.structuralCorrection, 30) ||
        ev.attackerReachedBoundary !== true ||
        ev.actualEffectRejected !== true ||
        ev.authorizedEffectSucceeded !== true ||
        ev.legacyInsecureTestOnly !== false ||
        !Array.isArray(ev.runs) ||
        ev.runs.length !== EXPECTED_PLATFORMS[id].length) {
      fail(id + " GREEN lacks structural cause, negative/positive proof, or full OS evidence");
      continue;
    }
    const seenPlatforms = new Set();
    for (const entry of ev.runs) {
      if (!isObject(entry) ||
          !EXPECTED_PLATFORMS[id].includes(entry.platform) ||
          seenPlatforms.has(entry.platform) ||
          !SHA.test(entry.sourceSha ?? "") ||
          entry.sourceSha === policy.baseline.mainCommitAtCreation ||
          !isPositiveInteger(entry.runId) ||
          !isPositiveInteger(entry.runAttempt) ||
          entry.jobName !== gate.expectedJob) {
        fail(id + " invalid/stale/nonmatching platform or workflow attestation");
        continue;
      }
      seenPlatforms.add(entry.platform);
    }
    if (seenPlatforms.size !== EXPECTED_PLATFORMS[id].length) {
      fail(id + " cannot omit a declared OS and still be GREEN");
    }
  } else {
    fail(id + " has illegal state; skipped/unsupported/waived is never green");
  }
}
if (totalEffort !== 100 || policy?.weightedWorkPlan?.percentTotal !== 100 ||
    !String(policy?.weightedWorkPlan?.unit ?? "").includes("NOT measured risk")) {
  fail("estimated WORK weights must total exactly 100 and never claim measured risk");
}

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if ((claimed.length || release) && !token) {
  fail("live GitHub API credentials required to certify any GREEN or RELEASE claim");
}
async function github(endpoint) {
  const response = await fetch("https://api.github.com/repos/" + REPO + endpoint, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "frontier03-evidence-fence/1",
    },
  });
  if (!response.ok) throw new Error("GitHub API " + response.status +
    " for " + endpoint);
  return response.json();
}
async function verifyEvidence() {
  if (!token) return;
  // The GitHub master issue must agree with the machine-readable source of
  // truth. A hand-edited checkbox is not proof and cannot silently create green.
  const issue = await github("/issues/21");
  const rows = new Map();
  for (const line of String(issue.body ?? "").split("\n")) {
    const match = /^- \[([ x])\] \*\*(G\d\d) —/.exec(line);
    if (match) {
      if (rows.has(match[2])) fail("duplicate master issue checkbox for " + match[2]);
      rows.set(match[2], match[1] === "x");
    }
  }
  if (rows.size !== 10) fail("missing or duplicated root issue acceptance checkboxes");
  for (const g of gates) {
    if (g && rows.has(g.id) && rows.get(g.id) !== (g.state === "GREEN")) {
      fail("root issue checkbox contradicts certified manifest state for " + g.id);
    }
  }
  const cache = new Map();
  for (const gate of claimed) {
    for (const att of gate.evidence.runs) {
      if (!cache.has(att.runId)) {
        const run = await github("/actions/runs/" + att.runId);
        const jobs = await github("/actions/runs/" + att.runId + "/jobs?per_page=100");
        const artifacts = await github("/actions/runs/" + att.runId + "/artifacts?per_page=100");
        cache.set(att.runId, { run, jobs, artifacts });
      }
      const { run, jobs, artifacts } = cache.get(att.runId);
      if (run.status !== "completed" || run.conclusion !== "success" ||
          run.run_attempt !== att.runAttempt ||
          run.head_sha !== att.sourceSha ||
          (run.repository?.full_name && run.repository.full_name !== REPO) ||
          !String(run.name).includes("Frontier03")) {
        fail(gate.id + " GitHub run is stale, untrusted, incomplete, or red");
      }
      const job = (jobs.jobs ?? []).find(x => x.name === gate.expectedJob &&
        x.conclusion === "success" && x.status === "completed");
      if (!job) fail(gate.id + " exact real-effect CI job not green");
      const required = ["attack", "authorized", "sensitivity"].map(
        kind => "frontier03-" + gate.id + "-" + att.platform + "-" + kind
      );
      for (const artifactName of required) {
        // Exact name, unexpired, SHA-256-attested evidence from this run.
        const matched = (artifacts.artifacts ?? []).find(x =>
          x.name === artifactName && x.expired === false);
        if (!matched || !/^sha256:[a-f0-9]{64}$/.test(matched.digest ?? "")) {
          fail(gate.id + " missing unexpired, SHA-256-attested " + artifactName);
        }
      }
    }
  }
}
if (token) {
  try { await verifyEvidence(); }
  catch (error) { fail("live attestation failure: " + String(error)); }
}
if (release && claimed.length !== 10) {
  fail("release requires 10/10 independently GREEN gates; current verified claims " +
    claimed.length + "/10");
}
if (failures.length) {
  console.error("FRONTIER03_FENCE_BLOCKED");
  for (const why of failures) console.error(" - " + why);
  process.exitCode = 73;
} else {
  console.log(release ? "FRONTIER03_RELEASE_ACCEPTED" :
    "FRONTIER03_PRETEST_POLICY_CONSISTENT");
  console.log(JSON.stringify({
    greenGates: claimed.length, totalGates: 10, mode: release ? "release" : "preflight",
    frontierAttacksExecutedByThisProgram: 0,
    claim: release ? "attested acceptance within declared scope" :
      "policy consistency only; NO security gate credited",
  }));
}
