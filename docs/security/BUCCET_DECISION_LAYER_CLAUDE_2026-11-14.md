# Agent Buccet — decision-layer red-team (Claude silo)

**Date:** 2026-11-14 (refreshed at the end of the session)
**Silo:** the **policy decision layer** — *does the law engine decide
allow/deny correctly?* This complements the transport / native-FS /
session-identity / proof work on the `security/*` and `redteam/frontier-*`
branches. Pincer intent: those branches prove the executor enforces whatever
was decided; this silo proves the decision itself is sound.
**Method:** every finding was reproduced before it was fixed — through the real
runtime (bodyguard, intercept, headless `follow_upl` autonomous mode) wherever
reachable — then fixed structurally, and locked with a `*-claude-redteam`
contract that **fails on the unpatched code** and carries **positive controls**
so legitimate work still flows.

## Summary

| ID | Hole | Real-runtime evidence (before) | PR |
|---|---|---|---|
| AUTH-01 | Broad scope auto-allowed secret/credential mutations, no human | `.env.production` rewritten `KEY=original → KEY=ATTACKER` | #19 |
| AUTH-02 | Corridor matched the unnormalized target (`/ws/../../etc/shadow`) | allow rail disagreed with executor | #19 |
| SPEC-01 | Allow beat a protective deny on raw field count (padding) | padded allow flipped deny → allow | #20 |
| REDOS-01 | Group-less regex corridor (`.*.*.*…`) backtracked super-linearly | >120 s on one crafted target | #20 |
| REDOS-02 | An unusable regex deny silently degraded to a substring that never matches | protective deny evaporated | #20 |
| SPEND-01 | Caps gated a caller-declared `amountNormalized` the human never saw | `$5,000.00` shown, `1` gated → cleared a `10` cap | #27 |
| AUTHZ-01 | A DOMAIN allow ("allow FS") pre-empted the secrets/egress walls | autonomous agent read `sk-live-123` past the secrets wall | #32 |
| AUTHZ-02 | `allow_if_law_clear` scope-expanded onto secrets (defense in depth) | not reachable on the standard path | #32 |
| AUTHZ-03 | Sensitive-target classifier gaps; `.config/gcloud` could never match | `.pgpass`, gh token, histories unflagged | #32 |
| DRAIN-01 | One spend approved as law could be replayed without limit | one `$10` approval → 25 spends, `$247` | #33 |
| SPEC-02 | Match-everything padding (`/.*/`, `""`, `"/"`) still inflated an allow | 4 variants flipped deny → allow | #34 |
| WALL-01 | Path walls covered one verb: `fs.write` but not append/move | autonomous `fs.append ~/.bashrc` of `curl … \| sh` persisted | #35 |
| UCON-01 | A standing allow overrode the user's own "don't delete X" | `notes.txt` deleted right after the user said not to | #36 |
| UCON-02 | Prohibition detection missed `’`, `dont`, remove/erase, move, `rm` | — | #36 |
| UCON-03 | Only "don't delete" was understood; "don't touch/edit/send X" ignored | config edited, forbidden payload posted | #38 |
| UCON-04 | An overwrite slipped past "don't delete X" | `notes.txt` clobbered | #38 |
| SESSION-01 | "Allow for this session" never expired under the CLI's fixed session id | a 13-hour-old allow approved today's write | #39 |

## Findings

### AUTH-01 — broad scope auto-allowed secret mutations (#19)
A standing workspace corridor also covered every secret beneath it, and the
intercept gate returned `allow` outright for in-scope writes, so the Box was
never consulted. **Fix:** a conservative sensitive-target classifier; the
intercept verdict downgrades a sensitive `allow` to `require_approval`;
`follow_upl` holds it closed. Ordinary work still auto-runs.
Contract: `agent-buccet-sensitive-target-claude-redteam`.

### AUTH-02 — corridor matched the unnormalized target (#19)
Prefix matching on the raw string let `/ws/project/../../etc/shadow` pass the
allow rail (the executor still refused it). **Fix:** resolve `.`/`..` lexically
before the prefix compare. Contract: `agent-buccet-upl-corridor-claude-redteam`.

### SPEC-01 / SPEC-02 — allow-vs-deny tiebreak (#20, #34)
A matching allow outranked a matching deny by a raw count of constraint fields,
so padding with inert metadata or duplicate patterns flipped a protective deny.
**Fix:** a deny is overridden only by an allow whose target is a strict subset
(a real carve-out) or that engages strictly more request-binding dimensions
(deduplicated, surface-aware). #34 closed the residual: patterns that match
everything (`/.*/`, `/(?:)/`, `""`, a `"/"` prefix) no longer count on the allow
side — an asymmetric discount, so it can only remove overrides.
Contract: `agent-buccet-upl-specificity-claude-redteam`.

### REDOS-01 / REDOS-02 — regex corridors (#20)
A linear-time gate (no quantified groups; no adjacent overlapping unbounded
quantifiers) plus a bounded input, validated against all 106 production
corridor patterns (none rejected, none slow). An unusable regex now resolves
fail-closed by polarity instead of degrading to a substring.
Contract: `agent-buccet-upl-regex-corridor-claude-redteam`.

### SPEND-01 — amount binding (#27)
`amountNormalized` must match the magnitude of the human-facing `amountRaw`
(US and EU formats); a divergent or unverifiable binding requires approval.
Contract: `agent-buccet-spend-amount-binding-claude-redteam`.

### AUTHZ-01..03 — broad authorization vs protective walls (#32)
A DOMAIN allow now yields to a matching track deny wall (in the shared lookup,
so both traffic arbiters inherit it); secret **reads** are classified and held
like writes; classifier gaps and the dead multi-segment entry are fixed.
Contract: `agent-buccet-authz-walls-claude-redteam`.

### DRAIN-01 — cumulative spend (#33)
A standing spend law always carries a cumulative bound (default: the approved
amount per 24 h); the corridor cap is a ceiling; the runtime enforces every
standing bound on the principal+bucket against the real executed-spend ledger,
including legacy uncapped corridors. Contract: `agent-buccet-spend-drain-claude-redteam`.

### WALL-01 — wall verbs (#35)
A wall that blocks writing a path also blocks appending to it and moving onto
it (gravity reports rename/link/symlink as `fs.move` on both ends); a wall that
blocks reading a path also blocks moving it. A structural invariant over all
~800 base walls prevents a single-verb wall from reopening this.
Contract: `agent-buccet-wall-kinds-claude-redteam`.

### UCON-01..04 — the user's own prohibitions (#36, #38)
A request the user prohibited this turn is never auto-approved by a standing
corridor or DOMAIN allow (standing denies still apply; an exact human approval
of that request still does). Prohibitions are classified as **destroy**
(delete, move, overwrite, destructive/truncating commands), **modify** (every
mutation) or **send** (outbound transfers naming the protected thing), and
detection handles typographic apostrophes, `dont` and common synonyms.
Contracts: `agent-buccet-user-constraint-claude-redteam`,
`agent-buccet-user-constraint-verbs-claude-redteam`.

### SESSION-01 — session allows expire (#39)
A human-granted SESSION-scoped allow expires 12 h after it was granted
(`AGENT_BUCCET_SESSION_ALLOW_TTL_HOURS`; `0` = never). Denies never expire;
system-seeded session entries are unaffected; expired entries stay in the
ledger for audit. Contract: `agent-buccet-session-ttl-claude-redteam`.

## Still open / known limits

- **User constraints are lexical.** They recognize explicit English
  prohibitions that name a target ("don't touch config.yml"). Paraphrases
  ("leave X alone", "keep X as is"), other languages, and constraints that
  refer to something only by description are not detected.
- **SESSION-01 is a policy choice.** 12 h bounds human session allows; it does
  not change how session ids are minted or persisted. If "session" should mean
  "this process", that is a product decision on top of this.
- **Lint coverage.** Biome's configuration excludes `src/proof/`; changes there
  (including `user-path-ledger.ts`) are covered by `tsc` and the contracts, not
  by biome.
- **Silo boundary.** Executor, native filesystem, transport, host identity and
  proof integrity are the frontier branches' surface and are not assessed here.
