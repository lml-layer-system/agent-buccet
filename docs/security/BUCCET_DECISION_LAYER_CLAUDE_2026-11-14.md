# Agent Buccet — decision-layer red-team (Claude silo)

**Date:** 2026-11-14
**Silo:** This pass targets the **policy decision layer** — *does the law engine
decide allow/deny correctly* — complementary to the transport / native-FS /
session-identity / proof work on the `security/*` and `redteam/frontier-*`
branches. Pincer intent: those branches prove the executor enforces whatever was
decided; this one proves the decision itself is sound. Files touched here
(`src/law/upl-tracks.ts`, `src/law/sensitive-target.ts`, `src/runtime/intercept.ts`,
`src/boundaries/headless.ts`) are not touched by those branches.
**Method:** real engine functions, deterministic unit contracts, plus a real
MCP-server autonomous end-to-end. No GUI/daemon required.

## AUTH-01 — broad scope silently auto-allows secret/credential mutations (fixed)

A standing scope/corridor for a workspace also authorizes every secret file
beneath it. Because the **intercept gate returns `allow` outright** for an
in-scope write, the Box is never consulted — so the agent can overwrite `.env`,
`~/.ssh/authorized_keys`, `.aws/credentials`, or `.git/config` **with no human,
in any mode**, not just autonomous.

**Proved end-to-end** (real `buccet mcp` server, autonomous mode, seeded
workspace corridor):

```
before fix:  write .env.production  →  auto-allowed, KEY=original → KEY=ATTACKER   (no human)
after  fix:  write .env.production  →  held: "Boundary denied: Human denied this action"
             write report.txt       →  still auto-runs (AUTO_OK)   ← ordinary work unaffected
```

**Fix (two layers, fail-safe):**
- `src/law/sensitive-target.ts` — a conservative classifier of credential/secret
  material (`.env*`, `.ssh`/`.aws`/`.gnupg`/`.kube`/`.docker` dirs, `id_rsa`,
  `authorized_keys`, `.npmrc`/`.netrc`/`.pypirc`, `.git/config|hooks`,
  `*.pem|*.key|*.pfx|*.p12`…). Ordinary source/docs are never flagged.
- `src/runtime/intercept.ts` — when the verdict for a **mutating** action would
  be `allow` and the target is sensitive, downgrade to `require_approval`. In
  interactive mode this surfaces a prompt; in autonomous it flows to follow_upl.
- `src/boundaries/headless.ts` — the autonomous `follow_upl` handler holds a
  sensitive mutation closed (`deny_once`) rather than auto-allowing it.

Net: credential/secret changes always get an explicit human checkpoint; they can
no longer ride a broad corridor silently. Legitimate autonomous work is
unaffected (verified: `report.txt` still auto-runs).

Tests: `contracts/law/agent-buccet-sensitive-target-claude-redteam.ts` (classifier,
deterministic) + the autonomous end-to-end above. Regression: upl-tracks,
upl-traffic, headless, headless-base-denials, foundation, upl-governance,
governance-defaults, and the FS-01…06 adversarial suite all still pass.

## AUTH-02 — corridor matched the unnormalized target (fixed)

`checkTrackConstraint` prefix-matched the raw target, so a corridor for
`/ws/project` accepted `/ws/project/../../etc/shadow` (the string still starts
with the pattern) even though it resolves outside. The confined-fs executor
denied it at run time, so there was **no live escape**, but the allow rail and
the executor disagreed — a fail-closed dependency on the last layer.

**Fix:** resolve `.`/`..` lexically for filesystem-style targets before the
prefix compare, so a traversal out of the corridor is treated as a corridor
exit. In-corridor `..` that stays inside is still allowed; URLs and exact/regex
modes are unchanged. Test:
`contracts/law/agent-buccet-upl-corridor-claude-redteam.ts` (fails on the old
matcher, passes now).

## Noted, not fixed here (needs maintainer review)

- **Fail-closed inversion by field count.** In `lookupUserPathTrackDecision`, a
  more-"specific" ALLOW outranks a DENY (`allowSpecificity > denySpecificity`),
  where specificity is a raw **count of constraint fields**, not how narrowly the
  pattern matches. A field-richer allow can therefore outrank a focused
  protective deny. An agent can't author law (the UPL process requires a human),
  so it is not obviously agent-reachable, but a rule that lets "specific allow"
  beat "protective deny" is worth a hard look before production.
- **Regex corridor patterns** (`targetPatterns` of the `/…/i` form) are untested
  for catastrophic backtracking / over-match.
- **Spend corridor:** `amountNormalized` is a caller-declared field gated
  directly (`amount > cap`); whether spend execution binds the real amount to the
  authorized intent, or an agent can under-declare, needs confirmation. Not yet
  probed to a conclusion.

## Scope honesty

Two decision-layer holes fixed and verified; three surfaces flagged with
specific suspicions. This is not a full audit of the matcher. Executor, transport,
session-identity and proof layers are covered on the frontier branches.
