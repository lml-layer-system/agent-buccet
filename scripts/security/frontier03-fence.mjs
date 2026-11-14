#!/usr/bin/env node
/*
 * Frontier03 acceptance fence: evidence-policy verification only.
 * This script DOES NOT run security tests or prove security by itself.
 * The release predicate fails closed on missing, obsolete, cross-platform,
 * unrelated, or unverified GitHub evidence.
 *
 * Privileged repository administrators must separately protect this script,
 * its workflows, gate manifest, and the evidence-producer CI workflow.
 */
import { readFileSync } from "node:fs";

const REPO = "lml-layer-system/agent-buccet";
const BASE_SHA = "3f04e7517ae0279e204083499eaaf4dcf1903a2b";
const SCHEMA = "agent-buccet/frontier03-acceptance-v1";
const EXPECTED = [
  {
    "id": "G01",
    "issue": 22,
    "platform": "linux",
    "failureClass": "Service lifecycle and crash recovery",
    "estimatedEffortPct": 12,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "actual service boot/restart evidence",
      "crash at protected commit",
      "stale socket/replay exclusion",
      "authorized post-recovery operation"
    ],
    "expectedJob": "Frontier03 / G01 evidence",
    "dependsOn": [
      "G02"
    ]
  },
  {
    "id": "G02",
    "issue": 22,
    "platform": "linux",
    "failureClass": "Installation authority and rollback",
    "estimatedEffortPct": 13,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "installed code and interpreter ownership",
      "partial-install rollback after faults",
      "untrusted UID denial",
      "successful authorized effect"
    ],
    "expectedJob": "Frontier03 / G02 evidence",
    "dependsOn": []
  },
  {
    "id": "G03",
    "issue": 23,
    "platform": "linux",
    "failureClass": "Registered host theft and impersonation",
    "estimatedEffortPct": 12,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "dedicated host UID separation",
      "credential and memory/FD theft attempts",
      "replay/rotation/revocation",
      "valid host execution"
    ],
    "expectedJob": "Frontier03 / G03 evidence",
    "dependsOn": [
      "G02"
    ]
  },
  {
    "id": "G04",
    "issue": 23,
    "platform": "linux",
    "failureClass": "Approval concurrency and cancellation",
    "estimatedEffortPct": 13,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "immutable exact-action consent binding",
      "concurrent reordered decisions",
      "cancel/revoke/timeout invalidation",
      "correct parallel authorized effects"
    ],
    "expectedJob": "Frontier03 / G04 evidence",
    "dependsOn": [
      "G01",
      "G03"
    ]
  },
  {
    "id": "G05",
    "issue": 24,
    "platform": "linux",
    "failureClass": "Hostile workspace source import",
    "estimatedEffortPct": 10,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "source inode and parent mutation",
      "special file/symlink/mount escape denial",
      "no out-of-scope read or write",
      "authorized reviewed-byte import"
    ],
    "expectedJob": "Frontier03 / G05 evidence",
    "dependsOn": [
      "G02",
      "G03"
    ]
  },
  {
    "id": "G06",
    "issue": 24,
    "platform": "linux",
    "failureClass": "Transactional migration recovery",
    "estimatedEffortPct": 10,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "crash/ENOSPC at every phase",
      "durable atomic commit or verified old state",
      "idempotent retries and cleanup",
      "authorized migration positive control"
    ],
    "expectedJob": "Frontier03 / G06 evidence",
    "dependsOn": [
      "G01",
      "G05"
    ]
  },
  {
    "id": "G07",
    "issue": 25,
    "platform": "macos",
    "failureClass": "Native macOS isolation parity",
    "estimatedEffortPct": 10,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "actual macOS privileged service identity",
      "native commit race effects on macOS",
      "launchd lifecycle and filesystem semantics",
      "authorized macOS file effects"
    ],
    "expectedJob": "Frontier03 / G07 evidence",
    "dependsOn": [
      "G03",
      "G04"
    ]
  },
  {
    "id": "G08",
    "issue": 25,
    "platform": "windows",
    "failureClass": "Native Windows isolation parity",
    "estimatedEffortPct": 10,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "actual Windows service/token/ACL boundary",
      "junction/reparse/rename attack effects",
      "service crash and recovery",
      "authorized Windows file effects"
    ],
    "expectedJob": "Frontier03 / G08 evidence",
    "dependsOn": [
      "G03",
      "G04"
    ]
  },
  {
    "id": "G09",
    "issue": 26,
    "platform": "cross-platform",
    "failureClass": "Alternate actuator authority bypass",
    "estimatedEffortPct": 5,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "enumerated reachable actuators and privileges",
      "real-effect bypass attempts for each entrypoint",
      "no direct/root fallback",
      "legitimate intended actuator positive controls"
    ],
    "expectedJob": "Frontier03 / G09 evidence",
    "dependsOn": [
      "G04",
      "G05",
      "G06",
      "G07",
      "G08"
    ]
  },
  {
    "id": "G10",
    "issue": 26,
    "platform": "cross-platform",
    "failureClass": "Novel adaptive failure discovery",
    "estimatedEffortPct": 5,
    "invariant": "No unauthorized real filesystem effect; valid scoped operation still succeeds.",
    "mustProve": [
      "stateful composition and metamorphic campaigns",
      "bounded reproducible seeds and real effects",
      "guard mutation must trigger red",
      "legitimate progress and resource controls"
    ],
    "expectedJob": "Frontier03 / G10 evidence",
    "dependsOn": [
      "G01",
      "G02",
      "G03",
      "G04",
      "G05",
      "G06",
      "G07",
      "G08",
      "G09"
    ]
  }
];
const PLATFORMS = {
  G01:["linux"],G02:["linux"],G03:["linux"],G04:["linux"],
  G05:["linux"],G06:["linux"],G07:["macos"],G08:["windows"],
  G09:["linux","macos","windows"],G10:["linux","macos","windows"],
};
const LABELS = { linux:/^ubuntu-/i, macos:/^macos-/i, windows:/^windows-/i };
const SHA = /^[a-f0-9]{40}$/;
const HEX_DIGEST = /^sha256:[a-f0-9]{64}$/;
const INTEGER = x => Number.isSafeInteger(x) && x > 0;
const OBJECT = x => x !== null && typeof x === "object" && !Array.isArray(x);
const TEXT = (x, least=24) => typeof x === "string" &&
  x.trim().length >= least && x.length <= 8192;
const REQUIRED_FLAGS = [
  "positiveAndNegativeEvidenceRequired",
  "rejectUnknownSkippedOrUnsupportedAsPass",
  "prohibitInheritedBaselineEvidence",
  "requireExactSourceCommit",
  "requireCurrentUnexpiredArtifactDigests",
  "requireSameRunAttackAndPositiveControl",
  "rejectTestOnlyInsecureBuildAsProductionProof",
  "rejectUnboundStatusClaims",
  "requireIssueCheckboxConsistency",
  "requireVerifiedPrerequisiteClosure",
];
const mistakes = [];
function reject(reason) { mistakes.push(reason); }
const release = process.argv.includes("--release");
const file = process.argv.find(x=>x.endsWith(".json")) ??
  "contracts/security/frontier03-acceptance.json";
const expectedSourceSha = process.env.GITHUB_SHA ?? "";
if (release && !SHA.test(expectedSourceSha)) {
  reject("release requires exact GITHUB_SHA (40-hex commit at tag)");
}
let spec;
try { spec = JSON.parse(readFileSync(file,"utf8")); }
catch (e) { reject("missing or malformed evidence contract: "+String(e)); spec={}; }

if (spec.schema !== SCHEMA || spec.repo !== REPO || spec.targetGateCount !== 10 ||
    spec.baseline?.mainCommitAtCreation !== BASE_SHA ||
    spec.baseline?.mergedPr !== 18 ||
    spec.baseline?.baselineDoesNotProveNewGates !== true) {
  reject("frozen source anchors missing, redefined, or treated as new gate evidence");
}
if (!OBJECT(spec.releasePolicy) ||
    REQUIRED_FLAGS.some(flag => spec.releasePolicy[flag] !== true)) {
  reject("one or more non-negotiable release/evidence constraints were weakened");
}
if (!Array.isArray(spec.gates) || spec.gates.length !== 10) {
  reject("gate list changed: require ten, in frozen order");
}
if (!spec.weightedWorkPlan || spec.weightedWorkPlan.percentTotal !== 100 ||
    typeof spec.weightedWorkPlan.unit !== "string" ||
    !spec.weightedWorkPlan.unit.includes("NOT measured risk")) {
  reject("percentages are ESTIMATED WORK SHARES, not measured risk/guarantee");
}
// No cycles or undeclared dependency edges. A graph made circular by later
// edits cannot be used to certify a set of green requirements.
const visiting=new Set(), visited=new Set();
function visit(id) {
  if (visiting.has(id)) { reject("circular gate prerequisite at "+id); return; }
  if (visited.has(id)) return;
  visiting.add(id);
  const gate=EXPECTED.find(x=>x.id===id);
  if(!gate) { reject("unknown dependency "+id); visiting.delete(id); return; }
  for(const dep of gate.dependsOn) visit(dep);
  visiting.delete(id);
  visited.add(id);
}
for(const gate of EXPECTED) visit(gate.id);

let work = 0;
const claimed = [];
for (let i=0; i<10; i++) {
  const gate=spec.gates?.[i], anchor=EXPECTED[i];
  if (!OBJECT(gate)) { reject(anchor.id+" missing"); continue; }
  for (const prop of Object.keys(anchor)) {
    if (JSON.stringify(gate[prop]) !== JSON.stringify(anchor[prop])) {
      reject(anchor.id+" altered pinned "+prop+" contract");
    }
  }
  work += anchor.estimatedEffortPct;
  if (gate.state === "UNVERIFIED") {
    if (gate.evidence !== null) reject(anchor.id+" UNVERIFIED must have null evidence");
    continue;
  }
  // Dependents may NOT stay GREEN when their upstream authority/evidence is
  // RED or UNVERIFIED. This is a graph implication check, not a runtime test.
  if (gate.state === "GREEN") {
    for(const predecessor of anchor.dependsOn) {
      if (!spec.gates.some(other=>other?.id===predecessor &&
            other.state==="GREEN")) {
        reject(anchor.id+" cannot be GREEN while prerequisite "+
          predecessor+" is not independently GREEN");
      }
    }
  }
  if (gate.state === "RED") {
    // A real failed future attack must be visible, not silently relabeled
    // UNVERIFIED; its failure trace must be verifiable but cannot be a pass.
    const bad=gate.failure;
    if (gate.evidence!==null || !OBJECT(bad) ||
        !TEXT(bad.observation,30) || !TEXT(bad.reproducer,24) ||
        !SHA.test(bad.sourceSha??"") ||
        !INTEGER(bad.runId) || !INTEGER(bad.jobId)) {
      reject(anchor.id+" RED must retain precise failed-run trace and null green evidence");
    }
    continue;
  }
  if (gate.state !== "GREEN") {
    reject(anchor.id+" invalid state: skip/waiver/unsupported never counts");
    continue;
  }
  if (gate.failure !== undefined && gate.failure !== null) {
    reject(anchor.id+" GREEN cannot retain an unresolved RED failure");
  }
  claimed.push(gate);
  const ev=gate.evidence;
  if (!OBJECT(ev) ||
      !TEXT(ev.threatModel,30) || !TEXT(ev.rootCause,30) ||
      !TEXT(ev.structuralCorrection,30) ||
      ev.attackerReachedBoundary !== true ||
      ev.actualEffectRejected !== true ||
      ev.authorizedEffectSucceeded !== true ||
      ev.legacyInsecureTestOnly !== false ||
      !Array.isArray(ev.runs) ||
      ev.runs.length !== PLATFORMS[anchor.id].length) {
    reject(anchor.id+" lacks source-backed failure-class closure and both effect controls");
    continue;
  }
  const seen=new Set();
  for (const att of ev.runs) {
    if (!OBJECT(att) ||
        !PLATFORMS[anchor.id].includes(att.platform) ||
        seen.has(att.platform) ||
        !SHA.test(att.sourceSha ?? "") ||
        att.sourceSha === BASE_SHA ||
        !INTEGER(att.runId) || !INTEGER(att.runAttempt) ||
        !INTEGER(att.jobId) ||
        att.jobName !== anchor.expectedJob ||
        !OBJECT(att.artifacts) ||
        ["attack","authorized","sensitivity"].some(k =>
          !OBJECT(att.artifacts[k]) || !INTEGER(att.artifacts[k].id) ||
          !HEX_DIGEST.test(att.artifacts[k].digest ?? ""))) {
      reject(anchor.id+" malformed platform-bound GitHub job/artifact attestation");
      continue;
    }
    seen.add(att.platform);
  }
  if (seen.size !== PLATFORMS[anchor.id].length) {
    reject(anchor.id+" missing platform: packaging/unsupported skip is NOT native parity");
  }
}
if (work !== 100) reject("estimated engineering work must total 100%");

const token=process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
if ((release || claimed.length) && !token) {
  reject("cannot certify a GREEN or release without live GitHub API");
}
async function api(route) {
  const response=await fetch("https://api.github.com/repos/"+REPO+route,{
    headers:{
      Accept:"application/vnd.github+json",
      Authorization:"Bearer "+token,
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"buccet-frontier03-evidence-fence",
    },
  });
  if (!response.ok) throw new Error("GitHub "+response.status+" for "+route);
  return response.json();
}
async function checkLive() {
  const issue=await api("/issues/21");
  const boxes=new Map();
  for(const line of String(issue.body??"").split("\n")) {
    const m=/^- \[([ x])\] \*\*(G\d\d) —/.exec(line);
    if (!m) continue;
    if (boxes.has(m[2])) reject("duplicate master tracker box for "+m[2]);
    boxes.set(m[2],m[1]==="x");
  }
  if (boxes.size !== 10) reject("master tracker missing one or more of 10 explicit boxes");
  for(const gate of spec.gates??[]) {
    if (!OBJECT(gate)) continue;
    if (boxes.has(gate.id) && boxes.get(gate.id)!==(gate.state==="GREEN")) {
      reject("GitHub issue #21 contradicts attested "+gate.id+" state");
    }
  }
  const cache=new Map();
  for(const gate of spec.gates??[]) {
    if (gate?.state !== "RED" || !OBJECT(gate.failure)) continue;
    const bad=gate.failure;
    if (!INTEGER(bad.runId) || !INTEGER(bad.jobId)) continue;
    const [run,jobs]=await Promise.all([
      api("/actions/runs/"+bad.runId),
      api("/actions/runs/"+bad.runId+"/jobs?per_page=100"),
    ]);
    const failedJob=(jobs.jobs??[]).find(x=>
      x.id===bad.jobId && x.run_id===bad.runId &&
      x.conclusion==="failure" && x.status==="completed");
    if (run.head_sha!==bad.sourceSha ||
        run.status!=="completed" || !failedJob) {
      reject(gate.id+" RED failure trace is not tied to a genuine failed GitHub job");
    }
  }
  for(const gate of claimed) {
    if (!OBJECT(gate.evidence) || !Array.isArray(gate.evidence.runs)) continue;
    for(const att of gate.evidence.runs) {
      if (!OBJECT(att) || !INTEGER(att.runId)) continue;
      if (!cache.has(att.runId)) {
        const [run, jobs, artifacts]=await Promise.all([
          api("/actions/runs/"+att.runId),
          api("/actions/runs/"+att.runId+"/jobs?per_page=100"),
          api("/actions/runs/"+att.runId+"/artifacts?per_page=100"),
        ]);
        cache.set(att.runId,{run,jobs,artifacts});
      }
      const {run,jobs,artifacts}=cache.get(att.runId);
      // Only green, completed main-branch CI at an exact source commit is
      // trustworthy. A PR from an untrusted fork or a manual run is not.
      if (run.head_sha!==att.sourceSha || run.head_branch!=="main" ||
          run.event!=="push" || run.status!=="completed" ||
          run.conclusion!=="success" || run.run_attempt!==att.runAttempt ||
          run.repository?.full_name!==REPO ||
          run.name!=="Frontier03 real-effect acceptance" ||
          !String(run.path??"").startsWith(
            ".github/workflows/frontier03-real-effects.yml@")) {
        reject(gate.id+" related GitHub run is not a trusted completed main-branch acceptance workflow");
      }
      if (release && att.sourceSha!==expectedSourceSha) {
        reject(gate.id+" stale evidence is not for the exact release-tag commit");
      }
      const job=(jobs.jobs??[]).find(x =>
        x.id===att.jobId && x.run_id===att.runId &&
        x.name===gate.expectedJob && x.status==="completed" &&
        x.conclusion==="success");
      if (!job) {
        reject(gate.id+" no green exact named job with this run/job ID");
      } else {
        const labels=Array.isArray(job.labels)?job.labels:[];
        if (!labels.some(x=>LABELS[att.platform].test(x))) {
          reject(gate.id+" wrong OS runner for claimed "+att.platform);
        }
        for(const name of [
          "Observe actual attacker effect denied",
          "Verify legitimate authorized commit",
          "Prove mutant is detected by test",
        ]) {
          if (!(job.steps??[]).some(x=>x.name===name &&
              x.status==="completed" && x.conclusion==="success")) {
            reject(gate.id+" missing successful boundary witness step: "+name);
          }
        }
      }
      for(const [kind,name] of [
        ["attack","frontier03-"+gate.id+"-"+att.platform+"-attack"],
        ["authorized","frontier03-"+gate.id+"-"+att.platform+"-authorized"],
        ["sensitivity","frontier03-"+gate.id+"-"+att.platform+"-sensitivity"],
      ]) {
        const pinned=att.artifacts?.[kind];
        const found=(artifacts.artifacts??[]).find(x=>x.id===pinned?.id &&
          x.name===name && x.expired===false &&
          x.workflow_run?.id===att.runId &&
          HEX_DIGEST.test(x.digest??"") && x.digest===pinned?.digest);
        if (!found) reject(gate.id+" missing exact live, digested "+kind+
          " artifact from the correct CI run");
      }
    }
  }
}
if (token) {
  try { await checkLive(); }
  catch(e) { reject("live attestation unavailable: "+String(e)); }
}
if (release && claimed.length!==10) {
  reject("10/10 required before publication: observed "+claimed.length+"/10 claims");
}
if (mistakes.length) {
  console.error("FRONTIER03_FENCE_BLOCKED");
  for(const m of mistakes) console.error(" - "+m);
  process.exitCode=73;
} else {
  console.log(release ? "FRONTIER03_RELEASE_EVIDENCE_ACCEPTED" :
    "FRONTIER03_PRETEST_SPECIFICATION_CONSISTENT");
  console.log(JSON.stringify({
    total:10,greenClaimCount:claimed.length,mode:release?"release":"preflight",
    attacksLaunched:0,securityMeaning:"metadata/contract consistency only",
  }));
}
