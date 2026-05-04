# Enterprise Witness Server

## Privacy guarantee

**Agent Buccet is local-first, zero-telemetry by default, and does not phone home. No network calls are made unless you explicitly configure your own witness server.**

The default audit ledger is a local cryptographically signed file on disk. No endpoints are contacted. Nothing is transmitted anywhere unless you explicitly configure your own witness destination.

## Who needs this

The witness server is **optional**. Most users never need it.

It exists for enterprise and security-paranoid deployments that require **immutable, off-machine audit logs** to prevent local tampering. The threat model: if a highly compromised agent process could theoretically reach and modify the local ledger file, an independent witness server on a separate machine closes that gap by anchoring each signed checkpoint somewhere the local process cannot reach.

If you run agents in high-stakes environments — financial systems, regulated infrastructure, multi-tenant deployments — and you require a tamper-evident trail that survives even a fully compromised host, this is your tool.

You must host this server on **your own infrastructure**. We provide the binary weapon. You control the deployment.

---

## Step 1 — Build the Go binary

Requires Go 1.22+. No C compiler needed. No container tooling. No extra runtime dependencies beyond the shipped binary.

```bash
cd server/witness
go mod tidy
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o buccet-witness .
```

That produces a single, self-contained executable: `buccet-witness`. Copy it to any Linux machine and run it — nothing else required.

**Cross-compile for other targets:**

```bash
# Linux ARM64 (Raspberry Pi, AWS Graviton, etc.)
GOOS=linux  GOARCH=arm64 go build -ldflags="-s -w" -o buccet-witness-linux-arm64 .

# macOS Apple Silicon
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o buccet-witness-darwin-arm64 .

# macOS Intel
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o buccet-witness-darwin-amd64 .
```

---

## Step 2 — Run it on your own server

Copy the binary to your internal server and run it:

```bash
scp buccet-witness user@your-server.internal:/opt/buccet-witness/
ssh user@your-server.internal

WITNESS_DB_PATH=/var/buccet/checkpoints.db PORT=9443 /opt/buccet-witness/buccet-witness
# [witness] listening on :9443
# [witness] db: /var/buccet/checkpoints.db
```

The server stores every checkpoint in a SQLite database with WAL mode for crash safety. The database is a single file — back it up like any other file.

**Run as a systemd service (recommended for production):**

```ini
# /etc/systemd/system/buccet-witness.service
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

```bash
sudo useradd -r -s /bin/false buccet
sudo mkdir -p /var/buccet && sudo chown buccet:buccet /var/buccet
sudo systemctl enable --now buccet-witness
sudo systemctl status buccet-witness
```

**Verify it's running:**

```bash
curl http://your-server.internal:9443/health
# {"status":"ok","service":"buccet-witness"}
```

---

## Step 3 — Configure Agent Buccet to point to your server

Set `BUCCET_WITNESS_URL` to your server's URL before running `buccet init` or any release build:

```bash
export BUCCET_WITNESS_URL=https://your-server.internal:9443
buccet init
```

Or add it to your shell profile so it persists across sessions:

```bash
echo 'export BUCCET_WITNESS_URL=https://your-server.internal:9443' >> ~/.bashrc
```

Or set it in your CI environment:

```yaml
# GitHub Actions example
env:
  BUCCET_WITNESS_URL: https://your-server.internal:9443
```

**Verify Agent Buccet is using your server:**

```bash
buccet status
# witness: https://your-server.internal:9443
# witness.mode: http
# witness.status: published
# witness.published: 2026-03-22T10:34:00Z
```

If your witness server is temporarily unreachable, Agent Buccet falls back to the local file automatically and flags `witness.fallback: true` in the status output so you know to investigate. No release is ever blocked.

---

## Environment variable reference

| Variable | Description |
|---|---|
| `BUCCET_WITNESS_URL` | Your witness server URL (e.g. `https://internal.company.internal:9443`). This is the primary env var. |
| `AGENT_BUCCET_WITNESS_HTTP_URL` | Legacy alias for `BUCCET_WITNESS_URL`. Both are supported. |
| `AGENT_BUCCET_WITNESS_FILE` | Write to a specific local file path instead of the default location. |
| `AGENT_BUCCET_WITNESS_REQUIRED` | Set to `false` to skip witness publication entirely. Requires `AGENT_BUCCET_WITNESS_OPT_OUT_REASON`. |
| `AGENT_BUCCET_WITNESS_OPT_OUT_REASON` | Required if `AGENT_BUCCET_WITNESS_REQUIRED=false`. Documents why witness is disabled. |

---

## What the server stores

Every checkpoint is signed ed25519 by the Agent Buccet installation before it is sent. The server stores the full original payload verbatim (`raw_json` column) alongside the decomposed fields, so signatures can be re-verified offline against the client's public key — no trust required in the server's decomposition.

```sql
SELECT checkpoint_id, signer_id, total_records, received_at
FROM checkpoints
ORDER BY received_at DESC
LIMIT 10;
```

The database is a plain SQLite file. You own it completely. Back it up, mirror it, archive it, feed it into your SIEM — it's just a file.

---

## What this is not

- Not a cloud service. Not hosted by anyone but you.
- Not required. Agent Buccet works fully offline without it.
- Not a monitoring tool. It receives and stores. Querying and alerting is your stack.
- Not secret. The checkpoints are signed by the client — the server just timestaps and persists them.
