# Buccet Witness Server

The external checkpoint anchor for Agent Buccet. Receives signed ledger checkpoints from agent installations and stores them in an append-only JSONL log.

The client already signs every checkpoint with ed25519 before sending it here. The server's only job is to be an independent, always-on store that the local process cannot reach to suppress — making it impossible for a compromised agent runtime to erase its own audit trail.

## What it does

- `POST /checkpoint` — receives a `BoundaryLedgerCheckpoint` JSON body, appends it to `data/checkpoints.jsonl`, returns HTTP 200
- `GET /health` — liveness probe, returns `{ status: "ok" }`
- Zero dependencies. Runs on Bun. No database. The log is the truth.

## Run locally

```sh
bun run server/witness/index.ts
```

Test it:
```sh
curl -X POST http://localhost:3000/checkpoint \
  -H "content-type: application/json" \
  -d '{"checkpoint_id":"test-01","signer_id":"dev","signature":"sig","generated_at":"2026-03-22T00:00:00Z","chain_ok":true,"cryptographic_ok":true,"total_records":1,"signature_algo":"ed25519"}'
```

## Deploy with Docker

```sh
# Build
docker build -f server/witness/Dockerfile -t buccet-witness .

# Run — mount a volume so the log survives container restarts.
docker run -d \
  -p 3000:3000 \
  -v /var/buccet/witness:/app/data \
  --name buccet-witness \
  buccet-witness
```

## Deploy on Fly.io (recommended for `witness.buccet.lml.dev`)

```sh
fly launch --name buccet-witness --dockerfile server/witness/Dockerfile
fly volumes create witness_data --size 1 --region iad
```

Add to `fly.toml`:
```toml
[mounts]
  source = "witness_data"
  destination = "/app/data"
```

```sh
fly deploy
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | TCP port to listen on |
| `WITNESS_LOG_PATH` | `./data/checkpoints.jsonl` | Append-only checkpoint log file |
| `WITNESS_ALLOWED_ORIGINS` | `*` | CORS allowed origins |

## The log format

Each line in `checkpoints.jsonl` is a `BoundaryLedgerCheckpoint` (as sent by the client) with an added `_received_at` timestamp from the server:

```json
{"checkpoint_id":"...","signer_id":"...","signature":"...","generated_at":"...","chain_ok":true,"cryptographic_ok":true,"total_records":42,"signature_algo":"ed25519","_received_at":"2026-03-22T10:34:00Z"}
```

The file is append-only. Never truncate it. If you need to rotate logs, copy and compress — never overwrite in place.

## Verifying the log

The checkpoints are signed with the client's ed25519 key. To verify a checkpoint, extract the `signer_id` (which is the client's public key identifier), retrieve the client's public key from their ledger, and verify the `signature` field against the checkpoint body.

The `buccet` CLI will include a `buccet verify` command to do this automatically.
