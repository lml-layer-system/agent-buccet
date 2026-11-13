#!/usr/bin/env node
/**
 * EFUE x Turing-inspired proactive security comb.
 *
 * Not a theorem prover for arbitrary programs. Exhaustively checks a bounded
 * consequence state machine, inventories real effect sinks in tracked source,
 * and detects missing runtime security evidence. Emits explicit residuals.
 *
 * Usage: node scripts/security/efue-turing-sweep.mjs [--gate]
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "artifacts", "security", "efue-turing");
const gate = process.argv.includes("--gate");
const categories = [
  { id: "effect:process", re: /\b(?:spawn|spawnSync|exec|execFile|execSync|fork)\s*\(/g, severity: "high", dimension: "host-effects" },
  { id: "effect:filesystem", re: /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|truncate|chmod|chown|mkdir|mkdirSync|renameat|unlinkat|mkdirat)\s*\(/g, severity: "high", dimension: "object-integrity" },
  { id: "effect:network", re: /\b(?:fetch|request|connect|createConnection)\s*\(/g, severity: "high", dimension: "egress" },
  { id: "authority:restore", re: /\b(?:restoreBoundaryRuntimeStore|restorePersistentBoundarySession|createPersistentBoundaryRuntimeStore|startPersistentBoundarySession)\s*\(/g, severity: "critical", dimension: "identity" },
  { id: "authority:mutation", re: /\b(?:revokeBoundaryGrant|openBoundaryPath|issueBoundaryGrant|setMode|settle)\s*\(/g, severity: "high", dimension: "authority-freshness" },
  { id: "proof:signing", re: /\b(?:createPrivateKey|generateKeyPairSync|signBoundaryLedger|appendBoundaryLedger)\s*\(/g, severity: "high", dimension: "proof-provenance" },
  { id: "native:syscall", re: /\b(?:openat|renameat|linkat|unlinkat|fstatat|fchmodat|mkdirat)\s*\(/g, severity: "critical", dimension: "object-integrity" },
];
const dirs = ["src/", "scripts/", "cli/", "apps/", "native/"];
const excluded = /(?:^|\/)(?:node_modules|dist|vendor|target|coverage|__fixtures__)\//;
const tests = /(?:\.test\.[cm]?[jt]s$|\.spec\.[cm]?[jt]s$|^contracts\/|^apps\/buccet-box\/(?:frontier|adversarial))/;
const read = (name) => readFileSync(path.join(root, name), "utf8");
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter((p) => dirs.some((d) => p.startsWith(d)) &&
    /\.(?:[cm]?[jt]sx?|c|h|rs|sh)$/.test(p) && !excluded.test(p) &&
    !tests.test(p) && p !== "scripts/security/efue-turing-sweep.mjs");
const sinks = [];
const filesByDimension = {};
for (const file of tracked) {
  const lines = read(file).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(?:\/\/|\*|#|\/\*)/.test(line)) continue;
    for (const category of categories) {
      category.re.lastIndex = 0;
      if (!category.re.test(line)) continue;
      sinks.push({ file, line: i + 1, category: category.id,
        dimension: category.dimension, severity: category.severity,
        excerpt: line.trim().slice(0, 180) });
      (filesByDimension[category.dimension] ??= new Set()).add(file);
    }
  }
}

// Bounded Turing-style exploration: 9 independent predicates, 9 distinct
// adversarial events, all initial worlds and all ordered event pairs.
// This specifies required behavior; it does not assert production conformance.
const dimensions = [
  "trustedActor", "boundSession", "signedApproval", "freshPolicy",
  "liveRequest", "sameObject", "containedNamespace", "trustedLedger",
  "interceptedEffect",
];
const events = [
  { name: "actor-impersonation", index: 0 },
  { name: "session-replay", index: 1 },
  { name: "approval-forgery", index: 2 },
  { name: "revocation", index: 3 },
  { name: "cancellation", index: 4 },
  { name: "object-substitution", index: 5 },
  { name: "directory-reparenting", index: 6 },
  { name: "ledger-rollback-or-key-compromise", index: 7 },
  { name: "unintercepted-host-effect", index: 8 },
];
const all = (1 << dimensions.length) - 1;
const mayCommit = (mask) => mask === all;
const transition = (mask, event) => mask & ~(1 << event.index);
let checked = 0;
let unsafe = 0;
for (let initial = 0; initial <= all; initial++) {
  for (const first of events) {
    for (const second of events) {
      const afterFirst = transition(initial, first);
      const afterSecond = transition(afterFirst, second);
      const allowed = mayCommit(afterSecond);
      // Monotonic denial: once any required property is invalid, no later
      // state may resurrect permission without an explicit trusted renewal.
      if (allowed && (afterFirst !== all || afterSecond !== all)) unsafe++;
      if (afterSecond & ~initial) unsafe++;
      checked++;
    }
  }
}
assert.equal(unsafe, 0, "Bounded consequence model violated monotonic denial");
assert.equal(checked, 512 * 9 * 9);

// Source checks are heuristics, never an attestation or a formal proof.
const evidence = [
  { id: "approval-signed-intent", file: "apps/buccet-box/backend.mjs",
    patterns: [/signedApprovalForRequest\s*\(/, /no verified pending action/] },
  { id: "approval-backpressure", file: "apps/buccet-box/backend.mjs",
    patterns: [/MAX_PENDING_APPROVALS/, /pending\.size\s*>=/] },
  { id: "approval-disconnect", file: "apps/buccet-box/backend.mjs",
    patterns: [/res\.once\(["']close["']/, /settle\(approvalId,\s*["']deny_once["']\)/] },
  { id: "out-of-band-cancel", file: "scripts/agent-buccet-mcp-server.ts",
    patterns: [/notifications\/cancelled/, /cancelledCalls\.add/, /BUCCET_MCP_CANCELLED/] },
  { id: "durable-policy-before-effect", file: "scripts/agent-buccet-mcp-server.ts",
    patterns: [/BUCCET_REVOKED/, /restoreBoundaryRuntimeStore/, /pathAuthoritySnapshot/] },
  { id: "no-follow-fs-paths", file: "native/box-fs-guard.c",
    patterns: [/O_NOFOLLOW/, /parent_from_root/, /regular_unique/] },
];
const checks = evidence.map((rule) => {
  let content = "";
  try { content = read(rule.file); } catch { /* missing is a failed check */ }
  const matches = rule.patterns.map((re) => re.test(content));
  return { id: rule.id, file: rule.file, status: matches.every(Boolean) ? "source-indicator-present" : "missing",
    note: "Textual indicator only: requires adversarial runtime verification." };
});

// Architectural requirements cannot be satisfied by string matching.
const blockers = [
  { id: "ID-02", dimension: "identity", severity: "critical",
    invariant: "Session grants cannot be inherited by a process whose identity is only caller-asserted.",
    residual: "Trusted host attestation or OS-isolated session capability is not established.",
    needed: "OS-backed host/session principal with an independently verifiable binding; reject unverified restore." },
  { id: "FS-07/10", dimension: "object-integrity", severity: "critical",
    invariant: "The committed bytes must be the approved inode's bytes, even under concurrent rename/unlink.",
    residual: "Named staging entries remain mutable by a same-user concurrent writer.",
    needed: "Isolated actuator/staging ownership and an atomic object-bound commit, verified under mutation." },
  { id: "FS-08/09", dimension: "object-integrity", severity: "critical",
    invariant: "A write or move must not land outside the authorized namespace if a parent is relocated.",
    residual: "A pinned directory fd can be moved out of scope before the final syscall.",
    needed: "OS-enforced immutable namespace/sandbox boundary, not lexical rechecks." },
  { id: "FS-11", dimension: "object-integrity", severity: "critical",
    invariant: "Move must act on the same reviewed source inode.",
    residual: "Preflight opens and closes source before path-based rename.",
    needed: "Object-bound move under an isolated namespace, or fail closed when source identity is mutable." },
  { id: "HOST-01", dimension: "host-effects", severity: "critical",
    invariant: "All host-native consequence paths must be mediated, not just MCP tools.",
    residual: "No independent proof that every supported host-native tool is intercepted.",
    needed: "Host integration inventory and enforced deny-by-default adapter coverage." },
  { id: "PROOF-01", dimension: "proof-provenance", severity: "high",
    invariant: "A same-user attacker cannot mint trusted operator receipts by stealing the ledger key.",
    residual: "No independent signer isolation or external rollback anchor established.",
    needed: "Separate trust principal for signing and anchored, monotonic receipts." },
];
const counts = {};
for (const s of sinks) counts[s.category] = (counts[s.category] ?? 0) + 1;
const report = {
  schema: "buccet-efue-turing-sweep/v1",
  scannedFiles: tracked.length, sinkCount: sinks.length,
  sinkCounts: counts,
  model: { stateBits: dimensions.length, worlds: 512, eventTypes: events.length,
    orderedTwoEventSequences: checked, specificationViolations: unsafe,
    scope: "bounded abstract model; NOT production proof" },
  sourceIndicators: checks,
  architecturalBlockers: blockers,
  unverifiedDimensions: Object.fromEntries(Object.entries(filesByDimension)
    .map(([k, v]) => [k, [...v].sort()])),
  sinks,
};
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
const summary = [
  "# EFUE x Turing proactive security comb",
  "",
  "This is an evidence inventory, NOT a claim of safety.",
  "",
  "Tracked implementation files scanned: " + tracked.length,
  "Potential effect/authority sinks: " + sinks.length,
  "Bounded abstract transition sequences: " + checked,
  "Specification violations: " + unsafe,
  "",
  "## Source indicators",
  ...checks.map((c) => "- " + c.id + ": " + c.status + " (" + c.file + ")"),
  "",
  "## Unresolved structural blockers",
  ...blockers.map((b) => "- " + b.id + " [" + b.dimension + "]: " + b.residual),
  "",
  "## Potential sink inventory",
  ...Object.entries(counts).map(([k, v]) => "- " + k + ": " + v),
  "",
  "The full source locations are in report.json. Findings are leads for review,",
  "not automatically confirmed exploits. A bounded model cannot solve the",
  "halting problem or guarantee arbitrary real programs are safe.",
];
writeFileSync(path.join(out, "summary.md"), summary.join("\n") + "\n");
process.stdout.write(summary.join("\n") + "\n");
if (gate && (blockers.length || checks.some((c) => c.status === "missing"))) {
  process.stderr.write("BUCCET_SWEEP_BLOCKED: unresolved architecture or missing source indicators\n");
  process.exitCode = 2;
}
