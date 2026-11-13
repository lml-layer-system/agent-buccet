# Agent Buccet Box — adversarial proving-ground report

**Date:** 2026-11-13  
**Scope:** Public `lml-layer-system/agent-buccet` feature branch `feat/buccet-box-interactive-autonomous`  
**Status:** **LINUX RED-TEAM REGRESSIONS GREEN ON FEATURE BRANCH. NOT YET PRODUCTION RELEASE-READY.** Original vulnerabilities are retained below as evidence. Separate host-native, subprocess and platform security claims remain unverified.  
**Environment:** Linux GitHub Actions runner, disposable Buccet home, temporary files, real public JSON-RPC MCP server, real Bodyguard runtime, actual filesystem side-effect verification. This is not an independently run Hermes/Cursor or macOS host bypass study.

## Root-remediation verification — same attack suite, November 13, 2026

- [**Full original MCP adversarial suite: green**](https://github.com/lml-layer-system/agent-buccet/actions/runs/43482154121). All six previously successful filesystem escapes now blocked, with the same test inputs and actual external-file/synthetic-secret assertions. The approved in-scope write **still executed**, ruling out a deny-all false positive.
- The MCP executor no longer performs raw `node:fs` file operations. It delegates through `src/box/confined-fs.ts` to `native/box-fs-guard.c` **only after the existing Bodyguard authorizes the action**. The guard uses no-follow, descriptor-relative directory traversal, unique-inode checks and atomic replacement for writes/append. It fails closed if the native helper is missing.
- **Notification replay/forgery:** the Box now requires matching canonical signed `ACTION_EXECUTED` / `ACTION_BLOCKED` ledger receipts and takes its visible facts from those receipts. The same previously successful token-only forged “Allowed” event returned **422**, with no fabricated event shown.
- **96/96** malformed and identity-spoofed MCP requests rejected. The separate signed-ledger tampering regression passed. The Linux real Electron GUI still passed with verified synthetic receipts.
- **Remaining scope boundary:** this does not establish sandbox protection from a malicious process that can alter the Box, its executable, the native helper, or the ledger-signing private key under the same OS identity. A stronger service-level or kernel-enforced identity separation is needed for that threat model.
- macOS app packaging and the source-installed native helper require their own platform tests; Linux Xvfb does not prove macOS filesystem semantics.

## What passed

- Correctly rejected an unregistered tool and an out-of-scope file write with forged `approved`, `userApproval`, and admin fields.
- Rejected static path traversal and static symlink-to-outside attempts.
- An actual human `deny_once` held write left the file unchanged; adding authorization-claim fields and retrying did not make it execute.
- An actual human `allow_once` on an in-scope write **did change** the file. This positive control prevents mistaking deny-all for enforcement correctness.
- Autonomous mode without standing UPL did not authorize a held write.
- Five concurrent hostile out-of-scope writes did not change the protected sentinel.
- Direct `move_file` crossing the workspace boundary did not succeed.
- A shell-tool bypass attempt was blocked **before approval**. A separate explicit tool-grant test also failed its benign-execution positive control with `Boundary denied: tool execution is denied by default`; therefore **approved subprocess confinement remains untested**, not passed.
- The HTTP executor denied unapproved redirect hops while retaining successful direct requests.
- A 96-case deterministic malformed/spoofed MCP input campaign returned 96 rejections and caused no protected-file modification (after isolated-fixture reset).
- The real Electron window, allowed/denied notification surface, approval click, denial click, and hidden-background bridge passed separate Xvfb GUI tests.

## Confirmed filesystem boundary escapes (stop-ship)

These all used synthetic test data and the ordinary public MCP executor. An adversarial second actor modified or prearranged filesystem aliases. **No actual personal files were touched.**

| ID | Attack | Verified consequence | Preconditions |
|---|---|---|---|
| FS-01 | Replace an approved file with a symlink while the UPL question is pending | An out-of-scope file was overwritten | External/same-user actor can change a filesystem entry during approval |
| FS-02 | Create an in-scope hardlink to an out-of-scope inode, then approve write | The out-of-scope inode was overwritten | Hardlink creation permissions, same filesystem |
| FS-03 | Replace an approved ancestor directory with a link to an outside directory while held | File inside outside directory was overwritten | Ability to rename/relink the in-scope directory |
| FS-04 | Replace approved append target with symlink while held | Out-of-scope file gained appended bytes | Same path-substitution precondition |
| FS-05 | Use an in-scope hardlink as an append target | Out-of-scope inode gained appended bytes | Same filesystem and hardlink permission |
| FS-06 | Replace approved in-scope read target with link to private file while held | MCP response included the out-of-scope synthetic secret | Ability to change a file entry during approval |

**Root cause:** A decision authorizes a logical path, but the direct filesystem executor resolves that path again at execution. The underlying inode, ancestor directory, or link may have changed. The authorization was not bound to a safely opened object, and a writable hardlink can alias protected storage.

**Now remediated for the six demonstrated Linux MCP filesystem cases:** descriptor-relative operations, hardened leaf handling, unique-file checks, and atomic writes. The exact six cases passed the same real-MCP assertions. This is not proof of general host sandboxing, hostile-code containment, or full macOS parity. Further kernel-level isolation, resource exhaustion and native host-tool bypass testing are still required.

## Notification trust finding

| ID | Attack | Verified consequence | Preconditions |
|---|---|---|---|
| BOX-01 | A same-user local process reads `~/.buccet/box/bridge.json` and submits an authenticated `/v1/event` | A fabricated `allow` event appeared in the bank-style feed without any MCP execution | Local process has access to the same user's token file |

**Fix retested in Linux:** bearer-token-only forged events now fail (HTTP 422); the operator UI only accepts events backed by locally verifiable Ed25519-signed ledger records. This is **not** evidence that the attacker authorized execution. A malicious same-user process that can access signing keys or replace the Box/native binary can still compromise local trust; that broader threat model needs stronger privilege separation.

## Proof ledger finding and retest

| ID | Observation | Result |
|---|---|---|
| LEDGER-01 | Alter signed receipt verdict from DENY to ALLOW and target from authorized to outside, leaving original signature/hash untouched | **Previously verified** as cryptographically valid — confirmed verifier defect |
| LEDGER-01 fix | Recompute hash from actual JSON-serialized content, sign new `json-v2` canonical records, mark legacy unreconstructable records unverified | **Retested:** tamper now fails with `signed receipt content hash mismatch detected` |
| LEDGER-02 | Delete a signed final record, then append a new legitimately signed event | **Confirmed residual rollback limitation:** the shortened and re-extended history still verified; the removed decision was absent |

Treat `ok` and `cryptographic_ok` as distinct results. Do not claim that historical v1 records offer the same body-integrity guarantee as the new v2 format. **Ledger v2 fixes are committed to the feature branch, not released.**

## Evidence and reproducibility

- [First confirmed approval-time file overwrite](https://github.com/lml-layer-system/agent-buccet/actions/runs/43473169056)
- [Independent symlink and hardlink reproduction](https://github.com/lml-layer-system/agent-buccet/actions/runs/43473794894)
- [Ancestor-swap, append, and read-exfil attacks](https://github.com/lml-layer-system/agent-buccet/actions/runs/43474509301)
- [MCP fuzz and notification injection](https://github.com/lml-layer-system/agent-buccet/actions/runs/43476456042)
- [Signed receipt verifier failure](https://github.com/lml-layer-system/agent-buccet/actions/runs/43475804368)
- [Ledger verifier fix retest](https://github.com/lml-layer-system/agent-buccet/actions/runs/43476456042)
- [Actual Electron GUI automation](https://github.com/lml-layer-system/agent-buccet/actions/runs/43457859501)

Run under Node 22 in a fresh clone:

```sh
npm ci
node apps/buccet-box/adversarial-mcp.mjs
node apps/buccet-box/adversarial-ledger.mjs
```

**Interpret failing tests carefully:** a deliberate adversarial check that reproduces an unauthorized side effect should fail. That failure is evidence of a vulnerability, not an unreliable test. Harness crashes must be corrected and separated from security results. Every test resets or creates disposable fixtures; no production data, external accounts, or public targets are used.

## Required release gates

1. **Filesystem:** **PASSED on Linux public MCP tests** — all six demonstrated FS escapes blocked, real positive-control Allow once succeeds. Extend to native macOS and host-hook integration before release.
2. **Subprocesses:** separately grant a benign command and verify execution, then test modified executable/script, filesystem access, environment inheritance, shell escapes, native hook bypass, process restart, and child processes.
3. **Agent pathways:** Cursor/Hermes/other supported host native tool inventory and bypass matrix, including non-MCP actions. Never display `Protected` for unobserved routes.
4. **Identity:** secure action provenance and local event origin; no forged decision notices under a defined threat model. Explicitly document same-user limitations where unresolved.
5. **Proof:** end-to-end signed receipt verification, canonical payload binding, trusted external checkpoint and rollback detection.
6. **Stress:** simultaneous clients, cancellations, timeouts, mode changes, restart during approvals, malformed inputs, rate limits, filesystem exhaustion, ledger corruption, loss of connectivity.
7. **Platforms:** repeat with native/macOS installation and signed/notarized build. Linux runner evidence is not macOS proof.
8. **Independent adversary:** do not use only handpicked scripts; include threat-model-led adaptive attackers and third-party review. No finite test suite proves that all bypasses are impossible.

**Bottom line:** The public Buccet runtime rejects many ordinary and adversarial actions correctly, and it can execute a legitimately human-approved write. But the demonstrated object-alias, approval-race, read-exfiltration, and notification-provenance defects are incompatible with claiming comprehensive protection today. The purpose of this proving ground is to uncover and remove exactly these weaknesses.
