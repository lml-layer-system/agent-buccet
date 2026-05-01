# UPL Policy Pack: Developer Workstation

A starter policy for software developers. Approves common dev actions so the bodyguard only asks about things that genuinely need review.

## How UPL works

Every time the bodyguard asks you "allow or deny?", your answer becomes a UPL entry. The UPL is checked first on every subsequent action — if there's a match, your decision is applied immediately without asking again.

You can also seed the UPL manually by editing `~/.buccet/data/agent-buccet-law-foundation/user-path-ledger.json`, or by running `buccet scope add` to add filesystem path approvals in bulk.

---

## Recommended approvals for this profile

### Filesystem — source tree

```
buccet scope add ~/workspace --actions fs.read,fs.write,fs.append,fs.mkdir,fs.move
buccet scope add ~/workspace --actions fs.delete
```

This covers reading, editing, creating, and reorganizing files inside your workspace.
`fs.delete` is listed separately because it's irreversible — you may prefer to keep that as ask-first.

### Tool execution — build + version control

When the bodyguard asks about `tool.exec` for the following commands, select "allow globally":

- `npm run *` — package scripts
- `bun run *` — bun scripts
- `git *` — version control (read-only ops like `git status`, `git log`, `git diff`)
- `git commit`, `git push` — if you want these to require explicit approval, select "allow for session" instead of "allow globally"

### Network — outbound reads (package registries, docs)

When the bodyguard asks about `network.send` to the following targets, select "allow globally":

- `registry.npmjs.org`
- `registry.yarnpkg.com`
- `docs.anthropic.com`
- `api.github.com` — for gh CLI operations

For other outbound network destinations, leave as ask-first. An agent calling an unexpected endpoint is worth knowing about.

---

## What to leave as ask-first

| Action | Reason |
|---|---|
| `fs.delete` outside `~/workspace` | Irreversible, low frequency |
| `sys.credential.read` | Agents should not read credentials silently |
| `sys.credential.use` | Same — you want to know when credentials are used |
| `db.insert`, `db.update`, `db.delete` | Destructive DB ops always worth reviewing |
| `comm.send` | Sending messages or emails: always ask |
| Any `network.send` to new domains | Unknown endpoints are the most common escalation vector |

---

## Example UPL file (after first few sessions)

The bodyguard builds this automatically as you respond to prompts. This is what a healthy developer UPL looks like after a few days of use:

```json
{
  "specVersion": 1,
  "userApprovedLawPaths": [
    {
      "id": "upl_01abc",
      "type": "APPROVED",
      "path": "fs.write ~/workspace",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T10:00:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "FS",
      "notes": "workspace write approved globally"
    },
    {
      "id": "upl_01def",
      "type": "APPROVED",
      "path": "tool.exec npm run",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T10:05:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "TOOL"
    }
  ],
  "userDeniedLawPaths": [
    {
      "id": "upl_01ghi",
      "type": "DENIED",
      "path": "sys.credential.read",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T10:10:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "SYS",
      "notes": "never allow agents to read credentials silently"
    }
  ]
}
```

The `scope` field controls lifetime:
- `GLOBAL` — survives process restarts and new sessions. Your standing law.
- `SESSION` — active for the current session only. Resets on next `buccet init` or restart.
- `DOMAIN` — applies to all actions in the same action class (e.g. all `fs.*` actions).
