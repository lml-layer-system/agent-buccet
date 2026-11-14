# Protected native filesystem boundary

**Scope:** public Agent Buccet native filesystem execution. This document
describes implementation and deployment requirements only; no private methods,
source protocols, or internal research documents are included.

## Security contract

Buccet may execute filesystem effects only when the authorized object and
its containing namespace are controlled by an independent OS principal.
Pinning a directory descriptor is insufficient when a second same-UID process
can relocate that directory or change the name being committed.

The shipped `native/box-fs-guard.c` now rejects an unprivileged direct caller
and refuses roots, subdirectories, or preexisting files that are owned by
someone other than root or are group/other-writable. This is deliberately
stricter than the old direct native guard. The production
`executeScopedFileTool` also denies when no protected broker is configured.

On Linux, the protected route is:

1. A separately trusted OS controller completes independent authorization.
2. The root-only controller or service invokes the filesystem effect.
3. The root-owned broker verifies an independently root-owned `policy.json`
   on **every** operation, including reads and both endpoints of moves.
4. The broker invokes the production guard within its protected namespace.
5. A hostile process with a different, unprivileged UID cannot unlink names,
   replace source inodes, reparent protected directories, or access the private
   broker socket.

Neither caller-supplied laws nor access to the raw root-only UNIX socket is
sufficient to bypass the broker's independent policy.

## Provisioning prerequisites

Only a trusted OS administrator may deploy this service. Run the installer
from a previously reviewed **root-owned, non-group/other-writable** release
tree. All ancestors of the installer and Node executable must also be
root-owned and non-writable. SHA-256 values are pinned independently from
the release being installed.

The installer `scripts/provision-native-broker.sh` requires an instance
identifier, built native guard, broker source, and their independently checked
SHA-256 hashes. It also requires:

- `BUCCET_BROKER_NODE`: absolute path to a root-owned Node executable
  (optional when `node` on the privileged PATH is already protected).
- `BUCCET_POLICY_CONTROLLER_SRC`: reviewed source of
  `native/box-fs-policy-controller.mjs`.
- `BUCCET_POLICY_CONTROLLER_SHA256`: independently pinned SHA-256 of that
  controller.

With `--files-only`, it installs validated code and the default-deny policy
without starting or enabling a service. Without that flag, it creates a
restricted systemd service. The installed managed root is
`/var/lib/buccet-native/<instance>`, mode `0700`, and the broker socket
is root-owned `0600`. No untrusted-agent group or chmod access is granted.

**Never** execute the installer directly from an attacker-writable source
checkout via `sudo`. Privileged automation must stage and verify the
reviewed installer before execution.

## Operator policy

New installations contain an empty operator grant set:

```json
{
  "schema": 1,
  "root": "/var/lib/buccet-native/example",
  "allowed": []
}
```

Only an independently authenticated administrator may install replacement
policy material at `<managed-root>/policy.json` as root-owned mode `0400`.
A grant has an explicit operation and a relative path prefix, and may have an
expiry. For example, after operator review:

```json
{
  "schema": 1,
  "root": "/var/lib/buccet-native/example",
  "allowed": [
    {"op": "read", "prefix": "project"},
    {"op": "write", "prefix": "project", "expiresAt": "2027-01-01T00:00:00Z"}
  ]
}
```

The root-owned policy controller can be invoked only by a separately trusted
OS principal. It validates its configured root, loads operator policy, denies
unauthorized operations, and sends a bounded request to the private broker.
The broker independently revalidates policy immediately before invoking its
native guard. A move needs both source and destination independently granted.

## Verification

The Linux native frontier workflow verifies, independently:

- Shipped guard denies direct user-owned mutable namespaces (six operations
  from unprivileged and privileged callers).
- No broker, partial broker configuration, or spoofed socket fails closed.
- Root-owned broker code installation requires pinned artifact digests and
  protected installer/interpreter paths.
- Installed controller begins with **zero** granted actions, accepts a
  root-installed restricted grant, and rejects ungranted targets.
- Broker raw-socket requests remain subject to independent operator policy.
- Five original deterministic races actually pause at the production native
  `renameat` boundary with a separate untrusted UID attempting both relevant
  mutations. The kernel denies all ten attempts while legitimate operations
  commit correctly.
- The intentionally insecure `-DBUCCET_INSECURE_TEST_ONLY` build retains
  historical vulnerability evidence **only as an isolated, nonshipping test
  artifact**. It must never be packaged or deployed.

## Release limitations

This is not a claim of complete production autonomous-agent isolation:

- The privileged controller's automated connection to the normal MCP host
  and the operator's UI approval workflow is not yet implemented or attested.
  Never promote the untrusted agent process to root merely to reach the socket.
- The root-owned managed workspace is intentionally distinct from
  user-writable workspaces. Import/export or synchronization must be separately
  authorized and isolated before using ordinary user projects.
- macOS and Windows do not have an equivalent broker implementation here.
  Their unprivileged filesystem execution must fail closed.
- A compromised root OS principal, malicious privileged installer, or
  already-exfiltrated root-owned signing/approval state is outside this
  filesystem-principal threat model. Additional host protection remains
  necessary.

Keep the feature in draft until a trusted application-to-controller launch
and operator authorization path is verified without removing the five attack
and legitimate-consequence tests.
