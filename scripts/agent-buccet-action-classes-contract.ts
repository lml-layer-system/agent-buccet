import {
  boundaryDatabaseAction,
  boundarySystemAction,
  createBoundaryGravityService,
  createBoundaryActionRequest,
  issueBoundaryGrant,
  startPersistentBoundarySession,
} from "../lib/lml/agent-boundary/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-action-classes-${runId}`;
  const actorId = "user:action-classes-contract";

  let config = await startPersistentBoundarySession({
    sessionId,
    actorId,
  });

  const gravity = createBoundaryGravityService();

  const dbRequest = createBoundaryActionRequest({
    config,
    actionKind: "db.query",
    target: "analytics",
  });
  const dbOutOfScope = await gravity.enforceRequest({
    config,
    request: dbRequest,
  });
  assert(dbOutOfScope.outcome === "nsl_grant_offer", "expected out-of-scope database query to yield NSL grant offer");

  const sysCredentialRequest = createBoundaryActionRequest({
    config,
    actionKind: "sys.credential.read",
    target: "github_token",
  });
  const sysCredentialDeny = await gravity.enforceRequest({
    config,
    request: sysCredentialRequest,
  });
  assert(sysCredentialDeny.outcome === "nsl_grant_offer", "expected out-of-scope system read to yield NSL grant offer before boundary deny");

  config = (await issueBoundaryGrant({
    config,
    resourceKind: "database",
    resourceValue: "analytics",
    grantedActions: ["db.query", "db.insert", "db.update", "db.delete"],
    issuedBy: actorId,
  })).config;

  config = (await issueBoundaryGrant({
    config,
    resourceKind: "system",
    resourceValue: "APP_MODE",
    grantedActions: ["sys.env.read", "sys.env.write"],
    issuedBy: actorId,
  })).config;

  const dbApproved = await boundaryDatabaseAction({
    config,
    database: "analytics",
    actionKind: "db.query",
    execute: async () => "rows-ok",
  });
  assert(dbApproved.requiresApproval, "expected database query to require approval after scope grant");

  const sysWriteDenied = await boundarySystemAction({
    config,
    target: "APP_MODE",
    actionKind: "sys.env.write",
    execute: async () => "should-not-run",
  });
  assert(!sysWriteDenied.allowed, "expected sys.env.write to be denied by default law");

  console.log("Agent Buccet action classes contract");
  console.log(`db out-of-scope outcome: ${dbOutOfScope.outcome}`);
  console.log(`system credential out-of-scope outcome: ${sysCredentialDeny.outcome}`);
  console.log(`db query requires approval: ${dbApproved.requiresApproval}`);
  console.log(`system env write allowed: ${sysWriteDenied.allowed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
