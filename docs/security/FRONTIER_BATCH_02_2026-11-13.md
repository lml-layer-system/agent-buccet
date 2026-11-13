# Agent Buccet — Frontier proving ground, batch 02

**Date:** November 13, 2026  
**Target:** Public Agent Buccet `main` after the merge of security PRs #10 and #11  
**Test-only branch:** `redteam/frontier-batch-02`  
**Status:** **RED — 10 reproducible adversarial findings, plus a macOS build failure.**  
**Release recommendation:** Do not claim the public runtime provides comprehensive consequence containment until these are addressed and the exact regressions go green.

This is a controlled, model-designed adversarial test campaign—not a certification, exhaustive proof, independent external red team, or live Cursor/Hermes test. All effects occurred in disposable GitHub Linux runner directories or the Box's temporary local HTTP bridge.

## Verified attack matrix

| Finding | Attack | Actual observed result | Required adversary capability |
| --- | --- | --- | --- |
| FS-07 | Replace the native guard's temporary file immediately before `renameat` | The committed file contained **different bytes** than the authorized payload | Concurrent write access to the directory during the operation |
| FS-08 | Move a pinned in-scope parent directory outside the authorized root while a write is paused | Guard exited successfully and wrote to **outside** the root | Rename/move permission on parent |
| FS-09 | Relocate a pinned destination directory while a move is paused | Source moved outside the authorized root | Rename/move permission on destination parent |
| FS-10 | Swap temporary content during `append` | Committed full file was attacker-controlled instead of original + approved append | Concurrent write access to directory |
| FS-11 | Replace move source inode after preflight, before rename | Guard moved a **different** file's bytes from those reviewed | Concurrent mutation of source entry |
| CP-01 | Use stolen same-user Box bearer token to submit a spoofed `admin:security-update` approval | Box displayed the forged operator prompt | Access to same-user token; **no runtime authorization obtained** |
| CP-02 | Flood the Box with 128 approvals, then disconnect every client | All **128 orphaned prompts** remained pending with five-minute timers | Access to same-user token |
| ID-01 | Launch MCP as an attacker actor using the existing victim session ID | After human Allow once, the attacker-labeled process **read the synthetic victim secret** using victim's stored grant | Launch/control MCP arguments and know same-user session ID |
| LIFE-01 | Send MCP `notifications/cancelled` for an action while pending | After stale Allow once, the cancelled write **still executed** | Client can cancel an in-flight request; human later clicks old prompt |
| LIFE-02 | Revoke the path law on disk while an MCP action waits for approval | After Allow once, process **still wrote** using its stale in-memory policy | A separate privileged process can update durable law while action is held |

**macOS packaging:** The `Buccet Box macOS preview` workflow fails before packaging because the guard's compile configuration does not expose `O_NOFOLLOW`. This is a **portability/build failure**, separate from those ten execution and control-plane findings. No macOS security parity is established.

## Why these findings matter

**Scope authority is not just a name.** A pinned directory descriptor can remain valid after the directory moves outside the policy root. A rename can atomically install *unapproved* bytes when the staged temporary entry can be replaced between check and commit. The original six Linux filesystem regressions checked other races; batch 02 targets these specific new windows.

**Session identity must be bound to authorization.** A caller-supplied `--session-id` was sufficient to restore another actor's stored path law, and the actor ID supplied at launch was not rejected. Human Allow once was still necessary in this tested policy, but the wrong actor's stored session authority reached the action runner.

**Cancellation and revocation must reach execution.** Both tests produced actual writes after their respective cancellation/revocation events. Revocation currently updates durable store but the live MCP process does not refresh the snapshot before execution; whether immediate cross-process revocation is guaranteed must be explicit in the contract.

**Operator surface is a security dependency.** The token-only fake prompt is a same-user capability limitation, not a proven authorization bypass. Unbounded, disconnected approval requests create an actionable availability and social-engineering concern.

## Evidence

- [Deterministic native object races: five breaches](https://github.com/lml-layer-system/agent-buccet/actions/runs/43492330311)
- [Approval spoofing and 128 orphaned requests](https://github.com/lml-layer-system/agent-buccet/actions/runs/43492862919)
- [Cross-agent victim-session execution](https://github.com/lml-layer-system/agent-buccet/actions/runs/43493571995)
- [Cancelled action and stale revocation execution](https://github.com/lml-layer-system/agent-buccet/actions/runs/43494147280)
- [Latest macOS compiler failure](https://github.com/lml-layer-system/agent-buccet/actions/runs/43492330132)

All test-only files and jobs are in [draft PR #13](https://github.com/lml-layer-system/agent-buccet/pull/13).

## Confidence controls

- The native suite compiles the **real merged** `native/box-fs-guard.c`; the `LD_PRELOAD` barrier is a test-only shared library that stops precisely before the actual `renameat` syscall, not a mock filesystem executor. Successful permitted file writes are mandatory positive controls.
- The real Box and MCP servers are used for control-plane and identity tests, including genuine held approvals, human Allow/Deny choices, and actual file consequences.
- Every attack used fresh temporary home, workspace, and synthetic marker content. No real user data was accessed.
- Existing standard CI and Electron GUI tests can remain green while these security acceptance tests fail. **Ordinary passing CI does not override reproduced boundary failures.**
- The native tests require a second actor capable of mutating files/dirs as the same OS identity. The control-plane tests require access to the Box token. Cross-agent session tests assume session ID knowledge and MCP launch capability.

## Structural fixes to evaluate (do not disable tests)

1. **Execution object binding:** protect approved output content and namespace membership from post-authorization substitution. Evaluate kernel-enforced scope boundaries, immutable/pinned staging objects, transactional commit guards, safe source/destination identity verification, and privilege-separated actuator where practical. A second `realpath()` check is insufficient.
2. **Owner-bound session capabilities:** reject restored sessions when the invoking actor identity doesn't cryptographically/operationally match; don't trust a caller-supplied actor flag by itself.
3. **Cancellation propagation:** cancel held actions and prevent execution after the effective cancellation event, including queued requests and process restarts.
4. **Revocation semantics:** implement an authority epoch or durable version compare at final execution (with reliable synchronization) so stale grants cannot remain active invisibly.
5. **Operator transport abuse:** attest request provenance, cap pending approvals, cancel on disconnected clients, and ensure forged prompts cannot masquerade as trusted runtime requests.
6. **Platform parity:** fix macOS build with correct feature detection and native behavior tests; run the same adversarial suite on each supported OS.
7. **Additional independent checks:** process escape if a benign `tool.exec` can actually be authorized, host-native Cursor/Hermes tool routing, ledger rollback with trusted external checkpoints, ASan/UBSan + coverage-guided native fuzzing, and fault injection under concurrent actor churn.

**Acceptance:** The exact same attacks must stop producing their observed consequences, a valid in-scope action must still execute, and a new full-coverage cross-host review should fail safely on any unobserved capability. No finite attack campaign proves that bypasses are impossible.
