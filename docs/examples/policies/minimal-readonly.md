# UPL Policy Pack: Minimal / Read-Only

The strictest sensible posture. Agents may read from explicitly approved paths. Everything else — writes, deletes, tool execution, network, credentials, database mutations — asks first, every time.

Use this when:
- You're running an untrusted or unfamiliar agent for the first time
- You want to audit what an agent actually does before granting anything broader
- You're building and testing your own agent and want to see every action it proposes

---

## Setup

```
buccet scope add ~/sandbox/reads --actions fs.read
```

This is the only pre-approved action. Everything else the agent tries will surface an approval prompt. Say yes or no. Each answer becomes a UPL entry. After a few sessions you'll have a precise law body that reflects exactly what the agent needs — nothing more.

---

## What this posture reveals

Running an agent under this policy for the first time tells you:

- Which filesystem paths the agent actually touches
- Whether it tries to exec processes you didn't expect
- Whether it attempts outbound network connections
- Whether it reads or uses credentials
- Whether it ever proposes actions with `authorityClaimed` or `requestsLedgerBypass` flags

That last set (the flag-based proposals) are the prompt-injection indicators. If you see them in `buccet logs`, you know something in the agent's input is trying to escalate privilege.

---

## Graduated approval path

Start with this policy, then promote to `developer-workstation.md` or `data-analyst.md` after you understand the agent's actual action footprint.

Typical progression over 3 sessions:

**Session 1:** Agent asks about 12 actions. You approve 8, deny 4. UPL has 12 entries.

**Session 2:** Agent asks about 4 new actions (the other 8 were resolved by UPL). You approve 3, deny 1. UPL has 16 entries.

**Session 3:** Agent asks about 1 new action. You approve it. Agent runs fully autonomously for everything it needs. You're done making decisions for the common case.

The bodyguard still blocks anything outside the UPL. New paths always surface.

---

## What to never approve under this profile

Some decisions you set once and never revisit:

| Action | Why always deny |
|---|---|
| Any action with `authorityClaimed: true` | Agent is claiming it has authority it doesn't have. Classic injection. |
| Any action with `requestsLedgerBypass: true` | Agent is trying to erase its own audit trail. Deny. Always. |
| Any action with `requestsLawMutation: true` | Agent is trying to change its own laws. The user writes laws. The agent does not. |
| `sys.credential.use` outside an explicit tool call | If you didn't tell it to use a credential, why is it doing that? |
| `comm.send` to unknown recipients | Who is the agent trying to contact? |

---

## Example UPL for this profile (after session 1)

```json
{
  "specVersion": 1,
  "userApprovedLawPaths": [
    {
      "id": "upl_min01",
      "type": "APPROVED",
      "path": "fs.read ~/sandbox/reads",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T08:00:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "FS",
      "notes": "only approved read path"
    }
  ],
  "userDeniedLawPaths": [
    {
      "id": "upl_min02",
      "type": "DENIED",
      "path": "sys.credential.read",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T08:01:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "SYS",
      "notes": "credentials are never readable by agents"
    },
    {
      "id": "upl_min03",
      "type": "DENIED",
      "path": "comm.send",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T08:02:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "COMM",
      "notes": "no outbound communication. ever."
    }
  ]
}
```

---

## Reading the logs

After running an agent under this policy, inspect what it proposed:

```
buccet logs --limit 50
buccet logs --json | jq '.[] | select(.actionKind | startswith("sys."))'
```

Any entry with `flags.authorityClaimed: true` or `flags.requestsLedgerBypass: true` is a red flag worth investigating in the agent's prompt chain.
