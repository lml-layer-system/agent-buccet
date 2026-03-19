# Agent Buccet Launch Proof

This is the shortest end-to-end public proof path for Agent Buccet.

## Goal

Show, in one flow:
- install works
- the bodyguard starts
- the hook path is live
- bad motion is stopped by the same runtime
- the ledger records what happened
- the system uninstalls cleanly

## Flow

### 1. Install

Hosted-ready:

```bash
sh dist/releases/install.sh
```

Or, once hosted:

```bash
curl -fsSL https://buccet.lml.dev/install | sh
```

### 2. Initialize

```bash
buccet init --no-default-scope
```

### 3. Build and start the hook path

```bash
buccet hook build
buccet hook start
buccet hook status
```

Expected:
- native hook library is built
- hook daemon starts
- status shows `running: yes`

### 4. Trigger a blocked action

Example:

```bash
buccet hook run -- /bin/sh -c 'echo test > /tmp/agent-buccet-proof.txt'
```

If `/tmp` has not been lawfully opened, Agent Buccet should stop the write.

What matters:
- the hook catches
- the hook freezes
- Agent Buccet evaluates
- the action is blocked or routed to approval

### 5. Inspect the ledger

```bash
buccet logs
npm run agent-buccet:ledger -- verify --format json
npm run agent-buccet:ledger -- key --format json
npm run agent-buccet:ledger -- checkpoint --write --format json
```

Expected:
- logs show the proposal/block path
- `verify` shows a valid chain
- `key` shows the active public signing identity
- `checkpoint` writes a signed checkpoint

### 5.5 Inspect swarm groups if many processes are waiting

```bash
buccet swarm list
```

If matching requests are waiting on the same unresolved target, this shows:
- one shared pending group
- how many frozen members are waiting inside it

Resolve it with:

```bash
buccet swarm approve <group-id>
# or
buccet swarm deny <group-id>
```

### 6. Uninstall

```bash
buccet uninstall
```

Expected:
- `~/.buccet` removed
- launcher removed
- no leftover user-space installation files

## What This Proves

- Agent Buccet installs and runs as a local-first containment layer
- the hook path feeds the existing Buccet brain
- many protected processes can feed the same Buccet brain concurrently
- laws and ledger stay in the main runtime
- the ledger is inspectable, signed, and checkpointable
- uninstall is clean
