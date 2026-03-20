# Agent Buccet
Building Ultimate Containment Constraints Every Time
![IMG_9302](https://github.com/user-attachments/assets/44141a3b-9b0b-40a9-978d-703d6f5970bf)

Persistent, CPU-friendly law and scope enforcement for AI agents.

Agent Buccet is the containment layer you add to the agent stack you already run.

Core of Agent Buccet:
- Agents can propose. They cannot authorize.
- No ambient authority.
- No out-of-scope actions.
- No silent destructive tool use.

It works across agent stacks because the protected boundary is the same:
- filesystem changes
- process execution
- network and recipient sends
- database mutations
- system and credential access

That means the same Agent Buccet Interceptor and Agent Buccet Gravity path can sit under:
- Claude Cowork
- Claude Dispatch
- OpenClaw
- NemoClaw
- OpenAI Agents
- LangGraph
- other tool-using agent runtimes

The framework can change.
The action boundary does not.

The public repo is centered on the shared Buccet brain.
Additional deep kernal os intercept can be added later for private environments without changing that core model.


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

If someone asks what Buccet is actually enforcing, that is the document to point them to.
Use `LAW_REFERENCE.md` when they want the exact active law body and runtime source mapping.

## Hosted Install

Hosted-ready release assets are generated under `dist/releases/`.

Example hosted flow:

```bash
sh dist/releases/install.sh
buccet status
buccet scope add .
buccet run -- /bin/echo protected
buccet logs
buccet uninstall
```

Local repo install remains available:

```bash
sh scripts/install-agent-buccet.sh
buccet init
buccet scope add .
```

## Proof Commands

Runnable example:

```bash
npm run demo:agent-buccet
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
