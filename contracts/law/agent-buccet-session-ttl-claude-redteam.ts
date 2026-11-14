/**
 * CLAUDE RED-TEAM (decision layer) — "allow for this session" must not live forever.
 *
 * SESSION-01: SESSION-scoped laws were pruned only when a session was
 * explicitly ended, and the CLI uses a fixed default session id
 * ("agent-buccet-default") that persists across restarts. So a human's "allow
 * for this session" silently became "allow until someone runs `buccet session
 * end`" — days or weeks later, for every agent run under that id.
 *
 * Fix: a human-granted SESSION-scoped ALLOW expires a bounded time after it was
 * granted (default 12h; AGENT_BUCCET_SESSION_ALLOW_TTL_HOURS, 0 = never).
 * Denies never expire (fail-closed); system-seeded session entries (re-seeded
 * whenever a path is opened) are not human grants and are unaffected. Expired
 * entries stay in the ledger for audit; they simply stop applying.
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createBoundaryBodyguard,
  createBoundaryHeadlessApprovalHandler,
  createPersistentBoundaryRuntimeStore,
  openBoundaryPath,
  saveUserPathLedger,
} from "./../../src/index.ts";
import {
  SESSION_UPL_ENTRY_ID_PREFIX,
  getActiveUserLawIds,
  lookupUserPathTrackDecision,
} from "./../../src/proof/user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryRuntimeConfig,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUserPathLedger,
} from "./../../src/runtime/types.ts";

const SESSION_ID = "agent-buccet-default"; // the CLI's fixed default
const HOUR = 3_600_000;

function sessionEntry(args: {
  id: string;
  type: "APPROVED" | "DENIED";
  target: string;
  ageHours: number;
}): BoundaryUplEntry {
  return {
    id: args.id,
    type: args.type,
    path: "p",
    pathHash: `h-${args.id}`,
    createdAt: new Date(Date.now() - args.ageHours * HOUR).toISOString(),
    scope: "SESSION",
    sessionId: SESSION_ID,
    status: "ACTIVE",
    witness: "w",
    modifiedAt: null,
    trackConstraint: {
      allowedActionKinds: ["fs.write"],
      targetPattern: args.target,
      description: args.id,
    },
  } as BoundaryUplEntry;
}

function decide(ledger: BoundaryUserPathLedger, target: string) {
  const request: BoundaryActionRequest = {
    requestId: "r",
    sessionId: SESSION_ID,
    actionKind: "fs.write",
    target,
    requestedAt: new Date().toISOString(),
    provenance: "mcp_host",
  };
  return lookupUserPathTrackDecision({
    ledger,
    session: { sessionId: SESSION_ID, actorId: "user:x" } as BoundarySession,
    request,
  })?.decision;
}
const ledgerOf = (approved: BoundaryUplEntry[], denied: BoundaryUplEntry[] = []) =>
  ({
    specVersion: 1,
    userApprovedLawPaths: approved,
    userDeniedLawPaths: denied,
  }) as BoundaryUserPathLedger;

async function main() {
  Reflect.deleteProperty(process.env, "AGENT_BUCCET_SESSION_ALLOW_TTL_HOURS");

  // ---- Unit: expiry of human session allows ----
  const stale = sessionEntry({ id: "UPL-000101", type: "APPROVED", target: "/ws", ageHours: 13 });
  const fresh = sessionEntry({ id: "UPL-000102", type: "APPROVED", target: "/ws", ageHours: 1 });
  assert.notEqual(
    decide(ledgerOf([stale]), "/ws/a.txt"),
    "allow",
    "a 13h-old session allow must have expired",
  );
  assert.equal(
    decide(ledgerOf([fresh]), "/ws/a.txt"),
    "allow",
    "a 1h-old session allow still applies",
  );

  // Denies never expire.
  const oldDeny = sessionEntry({ id: "UPL-000103", type: "DENIED", target: "/ws", ageHours: 200 });
  assert.equal(
    decide(ledgerOf([], [oldDeny]), "/ws/a.txt"),
    "deny",
    "an old session deny still applies",
  );

  // System-seeded session entries are not human grants.
  const seeded = sessionEntry({
    id: `${SESSION_UPL_ENTRY_ID_PREFIX}${SESSION_ID}-seed-0001`,
    type: "APPROVED",
    target: "/ws",
    ageHours: 200,
  });
  assert.equal(
    decide(ledgerOf([seeded]), "/ws/a.txt"),
    "allow",
    "seeded acceptance entries are unaffected",
  );

  // Expired allows also drop out of the active law ids; the entry stays for audit.
  const session = { sessionId: SESSION_ID, actorId: "user:x" } as BoundarySession;
  const ids = getActiveUserLawIds(ledgerOf([stale, fresh]), session);
  assert.ok(
    !ids.includes(stale.id) && ids.includes(fresh.id),
    "only unexpired allows are active law",
  );

  // Configurable: 0 disables expiry (previous behavior).
  process.env.AGENT_BUCCET_SESSION_ALLOW_TTL_HOURS = "0";
  assert.equal(decide(ledgerOf([stale]), "/ws/a.txt"), "allow", "TTL 0 disables expiry");
  process.env.AGENT_BUCCET_SESSION_ALLOW_TTL_HOURS = "24";
  assert.equal(decide(ledgerOf([stale]), "/ws/a.txt"), "allow", "a 24h TTL keeps a 13h-old allow");
  Reflect.deleteProperty(process.env, "AGENT_BUCCET_SESSION_ALLOW_TTL_HOURS");

  // ---- End-to-end: the CLI's fixed session, an allow granted 13h ago ----
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-session-ttl-"));
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = path.join(root, "user-path-ledger.json");
  const ws = path.join(root, "ws");
  await fs.mkdir(ws, { recursive: true });
  await saveUserPathLedger(
    ledgerOf([sessionEntry({ id: "UPL-000201", type: "APPROVED", target: ws, ageHours: 13 })]),
  );
  const store = await createPersistentBoundaryRuntimeStore({
    sessionId: SESSION_ID,
    actorId: "user:x",
  });
  const { config } = await openBoundaryPath({
    config: store.getConfig(),
    rootPath: ws,
    grantedActions: ["fs.write"],
    issuedBy: "user:x",
    seedBaseAcceptance: false,
  });
  store.replaceConfig({
    ...config,
    approvalHandler: createBoundaryHeadlessApprovalHandler({
      mode: "follow_upl",
      getLedger: async () => store.getConfig().upl as NonNullable<BoundaryRuntimeConfig["upl"]>,
    }),
  });
  const target = path.join(ws, "report.txt");
  const result = await createBoundaryBodyguard(store).enforceProposal({
    actionKind: "fs.write",
    target,
    successReason: "written",
    execute: async () => fs.writeFile(target, "written\n"),
  });
  const exists = await fs.stat(target).then(
    () => true,
    () => false,
  );
  assert.equal(
    result.allowed,
    false,
    "a session allow granted 13h ago must not auto-approve today's work",
  );
  assert.equal(exists, false);

  console.log(
    "session ttl: human session allows expire (default 12h, configurable); denies and seeded entries unaffected; stale allow no longer auto-approves",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
