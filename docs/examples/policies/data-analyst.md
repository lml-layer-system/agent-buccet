# UPL Policy Pack: Data Analyst

A starter policy for data analysis workflows. Agents read a lot, transform a lot, and rarely need to delete things or send to external endpoints. This pack reflects that shape.

---

## Profile characteristics

- Heavy `fs.read` and `db.query` — should be frictionless
- `fs.write` and `fs.append` — for output files and notebooks, approved in designated output dirs
- `fs.delete` — rare; always ask
- `network.send` — tight; no outbound by default except known data sources
- `comm.send` — never silently
- `sys.credential.*` — always ask; a data agent reading credentials silently is a red flag

---

## Recommended scope setup

```
buccet scope add ~/data --actions fs.read
buccet scope add ~/notebooks --actions fs.read,fs.write,fs.append
buccet scope add ~/output --actions fs.read,fs.write,fs.append,fs.mkdir
```

This gives the agent full read access to your data directory and write access to your designated output and notebook directories, without touching anything else on the filesystem.

---

## Database queries

When the bodyguard asks about `db.query` on your local databases, select "allow globally" if the target matches a known local connection string (e.g. `sqlite:///home/user/data/*.db`, `postgresql://localhost/*`).

Leave remote database queries as ask-first. Agents querying remote production DBs warrant review.

---

## Network — tight by default

For data analysts, unknown outbound network is the highest-risk action class. Recommended posture:

| Target | Decision |
|---|---|
| Known data API endpoints (e.g. `api.census.gov`, internal data lake URL) | APPROVED / GLOBAL |
| Package registry (`pypi.org`, `conda.anaconda.org`) | APPROVED / SESSION |
| Any unknown domain | DENIED / SESSION (then review case-by-case) |

---

## What to leave as ask-first

| Action | Reason |
|---|---|
| `fs.delete` anywhere | Rarely needed; losing a dataset is costly |
| `fs.write` outside `~/output` or `~/notebooks` | Unexpected writes warrant review |
| `db.insert`, `db.update`, `db.delete` | Data mutations should always be explicit |
| `comm.send` | Report delivery, email — always confirm |
| `sys.credential.read` | If an agent needs credentials, you want to know |
| `network.send` to unknown domains | Unexpected data exfiltration vector |

---

## Example UPL for this profile

```json
{
  "specVersion": 1,
  "userApprovedLawPaths": [
    {
      "id": "upl_da01",
      "type": "APPROVED",
      "path": "fs.read ~/data",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T09:00:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "FS",
      "notes": "data directory is read-only for agents"
    },
    {
      "id": "upl_da02",
      "type": "APPROVED",
      "path": "fs.write ~/output",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T09:01:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "FS",
      "notes": "agents may write to designated output directory"
    },
    {
      "id": "upl_da03",
      "type": "APPROVED",
      "path": "db.query sqlite://~/data",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T09:02:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "DB",
      "notes": "local SQLite queries approved"
    }
  ],
  "userDeniedLawPaths": [
    {
      "id": "upl_da04",
      "type": "DENIED",
      "path": "db.delete",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T09:03:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "DB",
      "notes": "agents must never delete data"
    },
    {
      "id": "upl_da05",
      "type": "DENIED",
      "path": "comm.send",
      "pathHash": "<sha256>",
      "createdAt": "2026-03-01T09:04:00Z",
      "scope": "GLOBAL",
      "status": "ACTIVE",
      "witness": "<ed25519-sig>",
      "domain": "COMM",
      "notes": "no outbound communication without explicit approval"
    }
  ]
}
```
