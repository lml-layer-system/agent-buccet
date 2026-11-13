# Agent Buccet Box — desktop preview

**One box. One UPL. The existing Agent Buccet runtime remains the authority.**

This directory contains the first compact desktop operator experience for the
public, open-source Agent Buccet runtime. It is an **engineering preview**, not
a signed macOS installer or a blanket system-wide containment guarantee.

## What it does

- **Interactive:** a real MCP action needing approval is held. The Box asks
  the operator; Allow once / Deny resolves the specific frozen request.
- **Autonomous:** never prompts. The same action must match standing UPL
  acceptance; unmatched approvals fail closed. All observed allow/deny results
  are recorded in the local activity feed and shown as desktop notifications.
- Minimize / close the window and the box remains resident (macOS menu bar
  when supported). Quit the app and pending approvals are denied.
- Connect Cursor and macOS Claude Desktop through the existing `buccet mcp`
  command. The connection UI backs up and preserves other MCP servers.
- The app reads the same local runtime's decisions. There is no duplicate
  policy interpreter, and the agent cannot call the Box to grant authority.

## Developer preview

Prerequisites: Node 22+, the OSS Agent Buccet runtime and its dependencies,
and a supported desktop OS (macOS primary).

From the repository checkout:

```bash
npm install
cd apps/buccet-box
npm install
npm start
```

After the app launches, choose **Connect** next to Cursor or Claude Desktop,
approve the native confirmation, and restart the host. This preview looks for
an installed `buccet` executable, then falls back to the local repo's CLI
with Node.

### macOS preview DMG (no terminal for end users)

The [Buccet Box macOS preview workflow](../../.github/workflows/box-macos.yml)
produces **unsigned** Intel and Apple Silicon DMGs, available as GitHub Actions
artifacts on the public PR. The packaged app includes the existing OSS
Agent Buccet CLI and runtime; its Connect buttons write MCP host configuration
for that bundled runtime. There is no separate CLI installation step in this
packaged flow.

For this preview:

1. Download the appropriate DMG artifact from the workflow run.
2. Move **Agent Buccet Box.app** into **Applications** before connecting your
   agent. Moving the app later changes its executable path and invalidates
   the host's saved MCP command until you reconnect.
3. Open the app, choose a supported MCP host, accept the native confirmation,
   and restart that host.
4. Test an action routed through Buccet. Do not treat "MCP configured" as proof
   that the host's other tools or arbitrary operating-system processes are
   intercepted.

**Unsigned preview warning:** macOS Gatekeeper may block the application.
This unsigned test artifact is for trusted developer testing only, **not a
notarized consumer release**. Proper Developer ID signing, notarization, and
on-device host/hook bypass tests are still required before production shipping.

The shipped app is not an always-on system service. Closing the window
minimizes it; quitting the process shuts down the bridge. Automatic login
startup and full host hook-coverage verification are not yet implemented.


## Enforcement versus UI

The Box is a local approval and activity **surface**, not an OS sandbox.

- The public MCP executor and supported runtime hooks remain the actual
  action interceptors. Host tools that aren't routed through them aren't
  magically protected just because an MCP config was added.
- The initial MCP preflight is followed by the existing Bodyguard-controlled
  execution path. Hard denial remains effective; a UI approval is not permission
  to bypass it.
- The Box bridge listens **only on 127.0.0.1**, requires a random bearer token,
  and stores the token in `~/.buccet/box/bridge.json` with owner-only file
  permissions. This is a same-user capability, not a defense against an
  already-compromised user account.
- The Box cannot expand law autonomously. In autonomous mode, a held action
  with no matching standing acceptance is denied.
- The activity feed accepts only **decisions with matching, locally
  verified Ed25519-signed canonical ledger receipts**; possessing the local
  bridge token alone cannot fabricate an Allowed event. This still does not
  prove every host-native action was intercepted, or protect against a
  malicious same-user process with access to the ledger signing key.
- Filesystem tool execution uses the POSIX confined native actuator
  (`native/box-fs-guard.c`) after the existing Bodyguard/UPL decision:
  descriptor-relative traversal, no-follow directory operations, and atomic
  file replacement. Missing native guard = deny (no unsafe JavaScript fallback).
  Windows does not yet have an equivalent backend and fails closed.
- The six previously successful Linux symlink, parent-swap, hardlink, append,
  and secret-read boundary escapes now pass the **same** real-MCP tests.
  This is not a general OS sandbox or proof of macOS hook coverage.
- Closing the window leaves the Box's bridge running. Closing the process,
  bridge timeout, or inability to reach the Box denies any unresolved
  interactive request; it does not auto-approve.
- The current UI exposes Allow once / Deny. Persistent UPL governance remains
  available in the existing UPL process; no stand-alone agent-writable law
  editor is introduced.

## Tests

```bash
node --test apps/buccet-box/backend.test.mjs
sh scripts/build-box-fs-guard.sh
node apps/buccet-box/adversarial-mcp.mjs
node apps/buccet-box/adversarial-ledger.mjs
npm run typecheck
npm run test:agent-buccet:mcp
```

The tests exercise the bridge and existing runtime contracts; a complete
on-device Hermes/Cursor adversarial demonstration and signed installer still
need separate validation. Do not represent a passing UI/backend test as proof
that every host-native capability is intercepted.

See the [November 13 independent attack reproduction and remediation notes](../../docs/security/BUCCET_BOX_REDTEAM_2026-11-13.md). Signed-ledger tail truncation without trusted external checkpoint, same-user signing-key compromise, executable tampering, approved subprocess confinement, macOS host-native bypass, and broad platform coverage remain separate security acceptance criteria.
