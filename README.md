# Agent Buccet
The Universal Agent Bodyguard — Building Ultimate Containment Constraints Every Time
![IMG_9302](https://github.com/user-attachments/assets/44141a3b-9b0b-40a9-978d-703d6f5970bf)

Works with any agent. Any framework. Indefinitely.

Agents can propose. They cannot authorize.

## Install

```bash
curl -fsSL https://buccet.lml.dev/install | sh
```

Protected in under 10 seconds:

```bash
buccet init
buccet scope add .
buccet run -- /bin/echo protected
buccet status
```

To remove cleanly:

```bash
buccet uninstall
```

---

## How It Works

Every proposed action runs through the same chain — always:

```
INTERCEPT  freezes it.   Motion stops. Nothing crosses without being seen.
GRAVITY    evaluates.    Runs the law body against the frozen proposal.
BODYGUARD  arrives.      Carries the UPL — the user's own runtime laws.
  → UPL match:    user's law decides on contact. Always.
  → No match:     user is asked. Their answer becomes a new UPL law.
LEDGER     signs it all. Every step, chained. The agent cannot erase it.
```

The human is always the boss. The agent never self-authorizes.

That chain is the same regardless of which agent framework sits above it:
- `@anthropic-ai/sdk` (Anthropic Claude SDK)
- NemoClaw / NeMo Guardrails
- OpenAI Agents
- LangGraph
- xAI API
- Claude Cowork, Claude Dispatch, OpenClaw
- any future agent that still crosses a real action boundary

The protected boundaries are always the same:
- filesystem changes
- process execution
- network and recipient sends
- database mutations
- system and credential access

The agent stack can change.
Agents can evolve.
The action boundary does not.

---

## The Proof in 30 Seconds

Run the end-to-end demo — it shows a blocked delete, an approved write, and the signed ledger:

```bash
npm run demo:agent-buccet
```

See 6 real prompt-injection attack patterns blocked live (authority claims, scope expansion, law mutation, ledger bypass, tool-output escalation, compound multi-flag):

```bash
npm run demo:agent-buccet:attacks
```

Or see the chain catch a real action in code:

```typescript
import {
  startPersistentBoundarySession,
  openBoundaryPath,
  evaluateBoundaryIntercept,
} from "agent-buccet";

// 1. Start a session
let config = await startPersistentBoundarySession({
  sessionId: "my-agent",
  actorId: "user:alice",
});

// 2. Open only the path the agent is allowed to touch
({ config } = await openBoundaryPath({
  config,
  rootPath: "/home/alice/workspace",
  grantedActions: ["fs.read", "fs.write"],
  issuedBy: "user:alice",
}));

// 3. Agent proposes a write outside that scope
//    INTERCEPT freezes → GRAVITY evaluates → BODYGUARD arrives with UPL → deny
const result = await evaluateBoundaryIntercept({
  config,
  request: {
    actionClass: "file",
    operation: "write",
    target: "/etc/passwd",          // outside opened scope
    provenance: "agent_inference",
  },
});
console.log(result.decision);    // "deny"
console.log(result.reason);      // "target is outside user-opened reachable scope"
// The ledger has a signed record of every decision. Agent never touched /etc/passwd.
```

The ledger:
```bash
npm run agent-buccet:ledger -- verify --format json
npm run agent-buccet:ledger -- logs
```

Every decision is signed, chained, and inspectable. The agent cannot erase it.

---

## Start Here

- [Agent Buccet README](docs/agent-boundary/README.md)
- [Quickstart](docs/agent-boundary/QUICKSTART.md)
- [Law Catalog](docs/agent-boundary/LAW_CATALOG.md)
- [Law Reference](docs/agent-boundary/LAW_REFERENCE.md)
- [Integrations](docs/agent-boundary/INTEGRATIONS.md)
- [Launch Boundary](docs/agent-boundary/LAUNCH_BOUNDARY.md)
- [Launch Proof](docs/agent-boundary/LAUNCH_PROOF.md)
- [Release Checklist](docs/agent-boundary/RELEASE_CHECKLIST.md)
- [Security Model](docs/agent-boundary/SECURITY_MODEL.md)
- [Threat Model Traceability](docs/agent-boundary/THREAT_MODEL_TRACEABILITY.md)
- [Current Limits](docs/agent-boundary/CURRENT_LIMITS.md)
- [Examples](docs/agent-boundary/examples/README.md)
- [Repo Boundary](docs/REPO_BOUNDARY.md)

## Agent Buccet Laws

The active Agent Buccet law body in this repo is documented here:
- [Law Catalog](docs/agent-boundary/LAW_CATALOG.md)
- [Law Reference](docs/agent-boundary/LAW_REFERENCE.md)

That catalog covers:
- Buccet base laws
- Buccet meta laws
- Agent action boundary laws
- Agent Buccet session and grant lifecycle laws
- Buccet ledger laws

To see exactly what Agent Buccet is enforcing, use `LAW_REFERENCE.md`.

---

## Proof Commands

Runnable example:

```bash
npm run demo:agent-buccet
```

Prompt-injection attack demo — 6 real attack patterns, all blocked:

```bash
npm run demo:agent-buccet:attacks
```

Gravity contract:

```bash
npm run test:agent-buccet:gravity-contract
```

Ledger contracts:

```bash
npm run test:agent-buccet:ledger-contract
npm run test:agent-buccet:ledger-rollup
npm run test:agent-buccet:ledger-writer
npm run agent-buccet:ledger -- verify --format json
npm run agent-buccet:ledger -- key --format json
npm run agent-buccet:ledger -- seal --format json
npm run agent-buccet:ledger -- checkpoint --write --format json
npm run agent-buccet:ledger -- witness-file --path ./ledger-witness.jsonl --format json
npm run agent-buccet:ledger -- witness-http --url http://127.0.0.1:8080/witness --format json
```

CLI and install contracts:

```bash
npm run test:agent-buccet:cli
npm run test:agent-buccet:install
npm run test:agent-buccet:hosted-install
```

Other core contracts:

```bash
npm run test:agent-buccet:action-classes
npm run test:agent-buccet:gravity-supervisor
npm run test:agent-buccet:wrapper-contract
npm run test:agent-buccet:swarm
npm run test:agent-buccet:intercept-daemon
npm run test:agent-buccet:intercept-server
npm run test:agent-buccet:system-intercept
npm run test:agent-buccet:hook-runtime
```

Runtime entrypoints:

```bash
npm run agent-buccet:gravity-daemon -- --session-id my-session
npm run agent-buccet:intercept-daemon -- --session-id my-session
npm run agent-buccet:intercept-server -- --session-id my-session --port 7788
npm run agent-buccet:gravity-bridge -- --listen-socket /tmp/buccet.sock --upstream-socket /tmp/agent-buccet-intercept.sock
buccet hook build
buccet hook start
buccet hook status
buccet hook run -- /bin/echo protected
```

Standalone export:

```bash
npm run package:agent-buccet
```

---

## Contributing / Development

Working directly from the repo:

```bash
sh scripts/install-agent-buccet.sh
buccet init
buccet scope add .
```

Build and typecheck:

```bash
npm run build
npm run typecheck
```

Run all stable contracts:

```bash
npm run check:agent-buccet:contracts-stable
```

---

## Repo Boundary

What is first-class here:
- `docs/agent-boundary/`
- `lib/agent-buccet/`
- `scripts/agent-buccet-*`
- `scripts/buccet.ts`
- `scripts/install-agent-buccet.sh`
- `scripts/install-agent-buccet-hosted.sh`
- `scripts/prepare-agent-buccet-package.ts`
- `native/`
