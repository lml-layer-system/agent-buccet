# Security Policy

## Scope

This repo contains the law body that governs Agent Buccet's behavior — not the Agent Buccet
runtime itself. Security issues here fall into two categories:

**In scope (report here):**

- Law coverage gaps — source laws that should be active but are absent, creating behavioral
  blind spots that could enable unsafe agent actions
- Incorrect exclusion — laws mistakenly excluded via `EXCLUSION_CRITERIA.md` that should be
  active, or active laws that should be excluded
- Tooling integrity bugs — errors in `verify-upstream-transfer.js`, generators, or the runtime
  substrate that corrupt the law body or produce a false-passing verification
- Incorrect manifests — count mismatches, stale SHA256 hashes, or incorrect governing law
  rosters in `user-path-ledger-spec.json`

**Out of scope (report to the `agent-buccet` runtime repo):**

- Runtime enforcement failures — the law body is present and correct, but the runtime does
  not enforce it
- Session continuity failures, interceptor bypasses, or gravity-path violations
- Issues in `lib/agent-buccet/` attach-point implementations

## Reporting

**Do not open a public issue for law coverage gaps.** A public gap disclosure before a fix is
in place creates a window where the gap is known and unpatched.

Report privately:
- Open a **private GitHub security advisory** on this repository, or
- Email the maintainers directly (contact via the organization profile)

Include:
- Which law family or category is affected
- The source law ID(s) involved (if known)
- A description of the behavioral gap and why it matters
- Any evidence — corpus excerpts, verify output, or test cases

## Response

We aim to acknowledge all reports within 5 business days. Coverage gap fixes are prioritized
by severity of the behavioral blind spot created.

Once a fix is committed and verified (`npm run verify:upstream-transfer` passes), the issue
may be disclosed publicly via a GitHub advisory.
