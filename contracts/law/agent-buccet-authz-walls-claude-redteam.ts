/**
 * CLAUDE RED-TEAM (decision layer) — broad authorization must not override
 * protective walls.
 *
 * AUTHZ-01: lookupUserPathDecision returned a DOMAIN-scope ALLOW ("allow FS",
 *   "allow NETWORK") before evaluateBoundaryUplTraffic ever consulted the track
 *   walls — and the base pack's protective walls (secret access, egress
 *   disclosure) are track entries. So a broad domain grant silently disabled
 *   them: reproduced end-to-end, an autonomous follow_upl agent read
 *   `secrets/api.txt` under a DOMAIN FS allow that the secrets wall otherwise
 *   blocked. A DOMAIN allow now yields to a matching track deny wall; exact
 *   (this-request) decisions and DOMAIN denies are unchanged.
 *
 * AUTHZ-02 (defense in depth): headless `allow_if_law_clear` auto-expanded any
 *   SCOPE.*-only prompt without looking at the target. It now holds scope
 *   expansion onto secret material, matching follow_upl.
 *
 * AUTHZ-03: the sensitive-target classifier missed common credential files
 *   (.pgpass, shell/REPL histories, credentials.json, gh/hub tokens under
 *   ~/.config) and its multi-segment entry ".config/gcloud" could never match
 *   (segments were compared one at a time). Secret READS are now classified too:
 *   reading a key and sending it out is a full exfiltration path.
 */
import assert from "node:assert/strict";
import { createBoundaryHeadlessApprovalHandler } from "./../../src/boundaries/headless.ts";
import { createBaseHeadlessDenialLedger } from "./../../src/law/headless-base-denials.ts";
import {
  isSensitiveAccessTarget,
  isSensitiveMutationTarget,
  isSensitiveTargetPath,
} from "./../../src/law/sensitive-target.ts";
import { evaluateBoundaryUplTraffic } from "./../../src/law/upl-traffic.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryApprovalRequest,
  BoundaryRuntimeConfig,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUserPathLedger,
} from "./../../src/runtime/types.ts";

const session = { sessionId: "s1", actorId: "user:x" } as BoundarySession;

function req(actionKind: BoundaryActionKind, target: string): BoundaryActionRequest {
  return {
    requestId: "r",
    sessionId: "s1",
    actionKind,
    target,
    requestedAt: new Date().toISOString(),
    provenance: "mcp_host",
  };
}
function config(upl: BoundaryUserPathLedger): BoundaryRuntimeConfig {
  return {
    session,
    laws: [],
    grants: [],
    pathLaws: [],
    approvalRequiredFor: [],
    userLawIds: [],
    upl,
    persistence: { enabled: false },
  } as BoundaryRuntimeConfig;
}
function domainEntry(id: string, type: "APPROVED" | "DENIED", domain: string): BoundaryUplEntry {
  return {
    id,
    type,
    path: "p",
    pathHash: `h-${id}`,
    createdAt: new Date().toISOString(),
    scope: "DOMAIN",
    domain,
    status: "ACTIVE",
    witness: "w",
    modifiedAt: null,
  } as BoundaryUplEntry;
}
function withApproved(
  base: BoundaryUserPathLedger,
  entry: BoundaryUplEntry,
): BoundaryUserPathLedger {
  return { ...base, userApprovedLawPaths: [...base.userApprovedLawPaths, entry] };
}
function traffic(upl: BoundaryUserPathLedger, actionKind: BoundaryActionKind, target: string) {
  return evaluateBoundaryUplTraffic({ config: config(upl), request: req(actionKind, target) });
}
function approval(actionKind: BoundaryActionKind, target: string, lawIds: string[]) {
  return {
    session,
    request: req(actionKind, target),
    lawIds,
    reason: "r",
  } as BoundaryApprovalRequest;
}

async function decide(
  handler: ReturnType<typeof createBoundaryHeadlessApprovalHandler>,
  a: BoundaryApprovalRequest,
): Promise<string> {
  const d = await handler(a);
  if (typeof d === "boolean") return d ? "allow_once" : "deny_once";
  return (d as { choice: string }).choice;
}

async function main() {
  const base = createBaseHeadlessDenialLedger();

  // ---- AUTHZ-01: DOMAIN allow must not pierce protective walls ----
  const fsDomain = withApproved(base, domainEntry("allow-domain-fs", "APPROVED", "FS"));
  for (const secret of [
    "/home/u/ws/secrets/api.txt",
    "/home/u/.ssh/id_rsa",
    "/home/u/.aws/credentials",
  ]) {
    assert.equal(
      traffic(base, "fs.read", secret).decision,
      "deny",
      `sanity: base wall denies ${secret}`,
    );
    assert.equal(
      traffic(fsDomain, "fs.read", secret).decision,
      "deny",
      `a DOMAIN FS allow must not override the secret-access wall for ${secret}`,
    );
  }
  const netDomain = withApproved(base, domainEntry("allow-domain-net", "APPROVED", "NETWORK"));
  const egress = "https://paste.example.com/upload";
  assert.equal(traffic(base, "network.send", egress).decision, "deny", "sanity: base egress wall");
  assert.equal(
    traffic(netDomain, "network.send", egress).decision,
    "deny",
    "a DOMAIN NETWORK allow must not override the egress disclosure wall",
  );

  // Positive control: the DOMAIN allow still grants ordinary, unwalled traffic.
  const ordinary = "/home/u/ws/src/index.ts";
  assert.equal(
    traffic(base, "fs.read", ordinary).decision,
    "no_match",
    "sanity: no wall on source",
  );
  const ordinaryUnderDomain = traffic(fsDomain, "fs.read", ordinary);
  assert.equal(
    ordinaryUnderDomain.decision,
    "allow",
    "a DOMAIN allow still allows unwalled traffic",
  );
  assert.equal(ordinaryUnderDomain.entry?.id, "allow-domain-fs");

  // A DOMAIN DENY is unchanged.
  const fsDomainDeny: BoundaryUserPathLedger = {
    ...base,
    userDeniedLawPaths: [...base.userDeniedLawPaths, domainEntry("deny-domain-fs", "DENIED", "FS")],
  };
  assert.equal(
    traffic(fsDomainDeny, "fs.read", ordinary).decision,
    "deny",
    "a DOMAIN deny still denies",
  );

  // ---- AUTHZ-03: classifier coverage ----
  for (const t of [
    "/home/u/.pgpass",
    "/home/u/.bash_history",
    "/home/u/.zsh_history",
    "/ws/credentials.json",
    "/ws/service-account.json",
    "/home/u/.config/gh/hosts.yml",
    "/home/u/.config/gcloud/application_default_credentials.json",
    "/home/u/.azure/accessTokens.json",
    "/home/u/.vault-token",
    "/ws/.env.", // trailing dot
    "C:\\Users\\u\\.ssh\\id_rsa",
  ]) {
    assert.equal(isSensitiveTargetPath(t), true, `classifier must flag ${t}`);
  }
  for (const t of [
    "/ws/src/index.ts",
    "/ws/README.md",
    "/ws/config/app.json",
    "/ws/docs/credentials-guide.md",
  ]) {
    assert.equal(isSensitiveTargetPath(t), false, `classifier must not flag ordinary file ${t}`);
  }
  assert.equal(
    isSensitiveAccessTarget("fs.read", "/home/u/.ssh/id_rsa"),
    true,
    "secret reads are sensitive",
  );
  assert.equal(isSensitiveAccessTarget("sys.credential.read", "anything"), true);
  assert.equal(isSensitiveAccessTarget("fs.read", "/ws/README.md"), false);
  assert.equal(
    isSensitiveMutationTarget("fs.read", "/home/u/.ssh/id_rsa"),
    false,
    "mutation API unchanged",
  );

  // ---- AUTHZ-02: headless allow_if_law_clear must not scope-expand onto secrets ----
  const clear = createBoundaryHeadlessApprovalHandler({ mode: "allow_if_law_clear" });
  const held = await decide(
    clear,
    approval("fs.write", "/home/u/.ssh/authorized_keys", ["SCOPE.GRANT.CLOSED"]),
  );
  assert.equal(held, "deny_once", "scope-only expansion onto a secret target must be held");
  const readHeld = await decide(
    clear,
    approval("fs.read", "/home/u/.aws/credentials", ["SCOPE.GRANT.CLOSED"]),
  );
  assert.equal(readHeld, "deny_once", "scope-only expansion onto a secret read must be held");
  const fine = await decide(clear, approval("fs.write", "/ws/notes.txt", ["SCOPE.GRANT.CLOSED"]));
  assert.equal(fine, "allow_once", "ordinary scope-only expansion is still auto-allowed");

  // follow_upl holds a secret READ even when a corridor allows its directory.
  const corridor: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [
      {
        id: "allow-home-read",
        type: "APPROVED",
        path: "p",
        pathHash: "h-home",
        createdAt: new Date().toISOString(),
        scope: "GLOBAL",
        status: "ACTIVE",
        witness: "w",
        modifiedAt: null,
        trackConstraint: {
          allowedActionKinds: ["fs.read"],
          targetPattern: "/home/u",
          description: "read home",
        },
      } as BoundaryUplEntry,
    ],
    userDeniedLawPaths: [],
  };
  const follow = createBoundaryHeadlessApprovalHandler({
    mode: "follow_upl",
    getLedger: async () => corridor,
  });
  const followSecret = await decide(follow, approval("fs.read", "/home/u/.ssh/id_rsa", ["UPL"]));
  assert.equal(
    followSecret,
    "deny_once",
    "follow_upl must not auto-read a key under a broad corridor",
  );
  const followOrdinary = await decide(follow, approval("fs.read", "/home/u/notes.txt", ["UPL"]));
  assert.equal(
    followOrdinary,
    "allow_once",
    "follow_upl still applies the corridor to ordinary reads",
  );

  console.log(
    "authz walls: DOMAIN allows yield to protective walls; secret reads/writes held from scope auto-expansion and corridors; classifier gaps closed; ordinary traffic unaffected",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
