# Buccet Witness Server

## This is your server

Agent Buccet does not host a witness endpoint and never will. This binary is the enterprise audit anchor that **you** deploy on **your** infrastructure. Your data never leaves your machines. We do not collect or store anything.

Agent Buccet is 100% offline by default. The witness server is optional — it exists for enterprise and security-paranoid deployments that want immutable, off-machine audit logs on infrastructure they fully control.

---

A single Go binary with an embedded SQLite database. No Docker. No runtime. No dependencies to install. Drop it on a machine and run it.

Receives signed ledger checkpoints from agent installations and stores them in an append-only SQLite table with WAL mode. The checkpoint is already signed ed25519 by the client — the server is an independent store that the local process cannot reach to suppress.

## Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — returns `{"status":"ok","service":"buccet-witness"}` |
| `POST` | `/checkpoint` | Receive and store a `BoundaryLedgerCheckpoint` |

### POST /checkpoint

**Request body** (JSON): a `BoundaryLedgerCheckpoint` as sent by the Agent Buccet client.

Required fields: `checkpoint_id`, `signer_id`, `signature`, `generated_at`

**Response codes:**
- `200` — stored successfully
- `400` — invalid JSON
- `409` — duplicate `checkpoint_id` (idempotent: safe to retry)
- `422` — missing required fields
- `500` — storage failure

## Build from source

Requires Go 1.22+. No C compiler needed — pure Go, zero CGO.

```sh
cd server/witness
go mod tidy
go build -ldflags="-s -w" -o buccet-witness .
```

### Cross-compile for any target

```sh
GOOS=linux  GOARCH=amd64 go build -ldflags="-s -w" -o buccet-witness-linux-amd64 .
GOOS=linux  GOARCH=arm64 go build -ldflags="-s -w" -o buccet-witness-linux-arm64 .
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o buccet-witness-darwin-amd64 .
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o buccet-witness-darwin-arm64 .
```

`-ldflags="-s -w"` strips debug symbols — smaller binary, no behavior change.
No `CGO_ENABLED=0` flag needed. `modernc.org/sqlite` is pure Go — cross-compilation just works.

## Run

```sh
./buccet-witness
# [witness] listening on :3000
# [witness] db: data/checkpoints.db
```

Test it:

```sh
curl http://localhost:3000/health

curl -X POST http://localhost:3000/checkpoint \
  -H "content-type: application/json" \
  -d '{
    "checkpoint_id": "cp_test_01",
    "signer_id": "dev-key",
    "signature": "aabbcc",
    "signature_algo": "ed25519",
    "generated_at": "2026-03-22T00:00:00Z",
    "total_records": 1,
    "chain_ok": true,
    "cryptographic_ok": true
  }'
```

## Configuration

| Env var | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port to listen on |
| `WITNESS_DB_PATH` | `./data/checkpoints.db` | SQLite database file path |
| `WITNESS_ALLOWED_ORIGINS` | `*` | CORS `Access-Control-Allow-Origin` value |

## Database

SQLite with WAL mode. Schema:

```sql
CREATE TABLE checkpoints (
    checkpoint_id      TEXT PRIMARY KEY,
    signer_id          TEXT NOT NULL,
    signature          TEXT NOT NULL,
    signature_algo     TEXT NOT NULL,
    generated_at       TEXT NOT NULL,
    total_records      INTEGER NOT NULL,
    latest_record_id   TEXT,
    latest_record_hash TEXT,
    chain_ok           INTEGER NOT NULL,
    cryptographic_ok   INTEGER NOT NULL,
    received_at        TEXT NOT NULL,
    raw_json           TEXT NOT NULL   -- original checkpoint JSON as sent by client
);
```

WAL mode (`PRAGMA journal_mode=WAL`) means readers never block writers and the database survives crashes cleanly.

The `raw_json` column preserves the original checkpoint payload verbatim so future tooling can re-verify signatures without relying on the decomposed columns.

## Deploy to bare metal

```sh
# Build linux binary locally
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o buccet-witness-linux-amd64 .

# Copy to your server
scp buccet-witness-linux-amd64 user@your-server.internal:/opt/buccet-witness/buccet-witness

# On the server — run directly
WITNESS_DB_PATH=/var/buccet/checkpoints.db PORT=9443 /opt/buccet-witness/buccet-witness
```

Systemd unit:

```ini
[Unit]
Description=Buccet Witness Server
After=network.target

[Service]
ExecStart=/opt/buccet-witness/buccet-witness
Environment=PORT=9443
Environment=WITNESS_DB_PATH=/var/buccet/checkpoints.db
Restart=always
RestartSec=5
User=buccet

[Install]
WantedBy=multi-user.target
```

## Configure Agent Buccet to use your server

Set `BUCCET_WITNESS_URL` to your server's URL before running `buccet init` or any release build:

```sh
export BUCCET_WITNESS_URL=https://your-server.internal:9443
buccet init
```

Verify it's picked up:

```sh
buccet status
# witness: https://your-server.internal:9443
# witness.mode: http
# witness.status: published
```

For the full setup guide, see [`docs/agent-boundary/enterprise-witness.md`](../../docs/agent-boundary/enterprise-witness.md).
