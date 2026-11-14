# Protected filesystem operator gate (Linux only)

**Status:** Draft PR #18. CI-verified isolation and manual approval gate, not yet a production release or complete trusted-host integration. This document describes public code; no private research protocols are included.

## Boundaries

- An unprivileged Buccet MCP process may only submit an exact filesystem operation through a root-owned *public request socket*. It cannot reach `operator.sock`, `broker.sock`, or the managed root.
- A separate privileged **human operator** must inspect the full operation (including all payload bytes), verify the SHA-256 fingerprint and explicitly confirm. An agent-supplied `approved` field or forged digest never authorizes execution.
- The root-owned broker **independently** checks `policy.json` at execution time. Operator approval does **not** override a missing/revoked path grant.
- The shipped C actuator rejects same-user execution in attacker-writable filesystem namespaces. Absence of the protected bridge never restores an unprotected default.
- This gateway does **not authenticate agent identity**. A request's actor name or session label is untrusted. Operators must independently verify the requester via a trusted host/session channel. The separate root confirmation intentionally remains necessary even after user-side Buccet Box approval.

## Administrator-controlled deployment

The two install scripts must be staged and invoked from a root-owned non-group/other-writable location. Both independently verify SHA-256 release artifact digests. Never invoke a root installer or privileged Node interpreter from an untrusted agent checkout or mutable toolchain.

1. Install the existing native guard, broker and protected policy controller using `scripts/provision-native-broker.sh`. Its installed `/var/lib/buccet-native/<instance>/policy.json` is **deny all by default**; only a privileged administrator may grant narrowly scoped operations. The broker service must pass the existing Linux isolation checks.
2. From the same protected administrator staging location, run `scripts/provision-native-operator-gate.sh <instance> <approval-gate-source> <gate-sha256> <operator-review-source> <review-sha256>`, with `BUCCET_BROKER_NODE` bound to an independently root-owned Node executable. It adds a separate systemd service dependent on the broker and installs the root-only reviewer.
3. The public *request-only* socket is `/run/buccet-native-gates/<instance>/request.sock`; the root-only review socket is `/run/buccet-native-gates/<instance>/operator.sock`. The protected native broker remains `/var/lib/buccet-native/<instance>/broker.sock`.
4. Configure the **unprivileged MCP process** with `AGENT_BUCCET_FS_BROKER_ROOT=/var/lib/buccet-native/<instance>`, `AGENT_BUCCET_FS_REQUEST_SOCKET=/run/buccet-native-gates/<instance>/request.sock`, and `AGENT_BUCCET_REQUIRE_ISOLATED_FS=1`. Do not pass a root credential or privileged broker socket to an agent.
5. After the normal Buccet policy and optional Box approval, the filesystem operation waits for an additional privileged operator decision. On a trusted root terminal, launch the installed `operator-review.mjs` with the root-only operator socket. It shows each full proposed operation and requires typing `APPROVE <sha256>` for that exact request. Any other response denies it. A non-interactive reviewer fails closed.

**There is no blanket auto-approval.** Reboots, unavailable services, invalid policy, lost sockets, expired pending requests, mismatched digests and cancelled requests fail closed. This creates deliberate operational friction until the trusted-host identity and delegated decision protocol are independently proven.

## Threats and validation

The frontier CI jobs exercise the production scoped executor as an unprivileged UID, root socket isolation, operator-only decisions, exact-payload binding, replay denial, cancellation, default-deny policy, and legitimate read/write effects. A separate job preserves all five original native commit races and verifies that an independent root principal prevents 10 hostile namespace mutations while authorized operations still work.

The legacy five-race **test-only** binary is explicitly built with `BUCCET_INSECURE_TEST_ONLY` and is not the shipped guard. A test demonstrating an unprotected legacy breach remains useful as a negative control, not as a supported deployment configuration.

**Unresolved for release:** trusted OS-level attribution of a specific MCP host/actor, complete automated end-to-end Box→trusted-host handshake (without treating same-user Box tokens or a same-user ledger key as privileged evidence), full systemd activation/restart testing outside the files-only CI sandbox, secure migration of existing user workspaces into separately managed roots, and equivalent macOS/Windows isolation. The root reviewer should treat every requester label as unverified until the host identity boundary is implemented.

Do not merge or claim a general production security guarantee from these CI tests alone.
