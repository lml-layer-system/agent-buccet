# Protected filesystem operator gate (Linux only)

**Status:** Draft PR #18. CI-verified Linux isolation, ordinary MCP→Box→root operator→native execution, and root-provisioned host proof. Not yet a production release or a full operating-system service deployment. This document describes public code; no private research protocols are included.

## Boundaries

- An unprivileged Buccet MCP process may only submit an exact filesystem operation through a root-owned *public request socket*. It cannot reach `operator.sock`, `broker.sock`, or the managed root.
- A separate privileged **human operator** must inspect the full operation (including all payload bytes), verify the SHA-256 fingerprint and explicitly confirm. An agent-supplied `approved` field or forged digest never authorizes execution.
- The root-owned broker **independently** checks `policy.json` at execution time. Operator approval does **not** override a missing/revoked path grant.
- The shipped C actuator rejects same-user execution in attacker-writable filesystem namespaces. Absence of the protected bridge never restores an unprotected default.
- The gate verifies an **exact-action HMAC** from a root-registered host proof delivered to MCP on inherited FD 3. A caller-provided actor name/session ID or forged FD proof is denied. The root registration can be revoked while an operator request is pending, and it is rechecked before the effect.
- This is **registered host proof-of-possession, not a substitute for OS process isolation**. A same-UID adversary able to read or modify the registered host's memory or inherited descriptor can steal its proof. The trusted host requires a dedicated OS principal that untrusted agents cannot inspect.
- In protected mode, a fresh normal **Buccet Box approval is required before a filesystem request is even sent** to the independently privileged operator gate. Box approval is a user-side decision, not a root privilege credential. The separate root confirmation intentionally remains necessary.

## Administrator-controlled deployment

The two install scripts must be staged and invoked from a root-owned non-group/other-writable location. Both independently verify SHA-256 release artifact digests. Never invoke a root installer or privileged Node interpreter from an untrusted agent checkout or mutable toolchain.

1. Install the existing native guard, broker and protected policy controller using `scripts/provision-native-broker.sh`. Its installed `/var/lib/buccet-native/<instance>/policy.json` is **deny all by default**; only a privileged administrator may grant narrowly scoped operations. The broker service must pass the existing Linux isolation checks.
2. From the same protected administrator staging location, run `scripts/provision-native-operator-gate.sh <instance> <approval-gate-source> <gate-sha256> <operator-review-source> <review-sha256>`, with `BUCCET_BROKER_NODE` bound to a root-owned Node executable and `BUCCET_HOST_ENROLLER_SRC` / `BUCCET_HOST_ENROLLER_SHA256` bound to the independently reviewed host issuer source and its pinned digest. It installs the root-only reviewer, gate, host-enrollment tool, and a root-owned `host-identities.json` registry that initially permits **no hosts**.
3. Register a trusted host **from the root operator**, using the installed `host-enroll.mjs` with `<protected-root> enroll <session-id> <actor-id> <dedicated-host-uid>`. The dedicated host UID must differ from untrusted agent UIDs. The issuer generates a fresh random 256-bit secret, atomically updates the root-only registry, and places the proof in `/run/buccet-native-host-credentials/<instance>/<session-id>.key`, owned mode `0400` by the registered host UID. Neither the secret nor the host's privilege is exposed to the agent. The same tool supports `revoke <session-id> <actor-id>` for immediate root-side removal of authority.
4. The host launcher opens its own protected proof file and starts MCP with that descriptor inherited as **FD 3**. Set `AGENT_BUCCET_FS_HOST_PROOF_FD=3` (descriptor number only), `AGENT_BUCCET_FS_BROKER_ROOT=/var/lib/buccet-native/<instance>`, `AGENT_BUCCET_FS_REQUEST_SOCKET=/run/buccet-native-gates/<instance>/request.sock`, and `AGENT_BUCCET_REQUIRE_ISOLATED_FS=1`. Its MCP `--session-id` and `--actor-id` must match the root registration. Never put the 256-bit proof in an environment variable, CLI flag, user home, or Box token file.
5. The public *request-only* socket is `/run/buccet-native-gates/<instance>/request.sock`; the root-only review socket is `/run/buccet-native-gates/<instance>/operator.sock`. The native broker remains `/var/lib/buccet-native/<instance>/broker.sock`. Untrusted agents cannot connect to either privileged socket.
6. After the normal Buccet policy **and fresh Box approval**, the request's action, target(s), and entire payload are MAC-bound to the registered host identity, checked against the root registry, and held pending for a separate privileged operator decision. On a trusted root terminal, launch the installed `operator-review.mjs` with the root-only operator socket. It shows the registered host and full proposed operation and requires typing `APPROVE <sha256>` for that exact request. Any other response denies it. A non-interactive reviewer fails closed.

**There is no blanket auto-approval.** Reboots, unavailable services, invalid policy, lost sockets, expired pending requests, mismatched digests and cancelled requests fail closed. This creates deliberate operational friction until the trusted-host identity and delegated decision protocol are independently proven.

## Threats and validation

The frontier CI jobs exercise the production scoped executor as an unprivileged UID, root socket isolation, operator-only decisions, exact-payload binding, replay denial, cancellation, default-deny policy, and legitimate read/write effects. A separate job preserves all five original native commit races and verifies that an independent root principal prevents 10 hostile namespace mutations while authorized operations still work.

The legacy five-race **test-only** binary is explicitly built with `BUCCET_INSECURE_TEST_ONLY` and is not the shipped guard. A test demonstrating an unprotected legacy breach remains useful as a negative control, not as a supported deployment configuration.

**Verified:** the real MCP server, normal Box backend, root-registered host proof, privileged exact-payload approval, native guard, and operator policy form a working Linux test chain. The tests reject copied actor/session labels with an independently forged 256-bit FD proof and deny execution if a registered host is revoked while the approval is pending. A separate enrollment test proves the protected proof file is unreadable by a different untrusted UID.

**Still unresolved for release:** formal host process/PID attribution beyond possession of an OS-separated key, hostile same-UID memory/fd theft without a dedicated host principal, a fully automatic independently authenticated Box→root delegated decision handshake (we deliberately retain a second root-human approval), complete systemd activation/restart/fault-injection testing outside the files-only CI sandbox, safe migration of user-writable workspaces into protected roots, and equivalent macOS/Windows isolation. Do not claim that a macOS packaging smoke test establishes kernel-enforced parity.

Do not merge or claim a general production security guarantee from these CI tests alone.
