# Agent Buccet
Building Ultimate Containment Constraints Every Time
![IMG_9302](https://github.com/user-attachments/assets/44141a3b-9b0b-40a9-978d-703d6f5970bf)

Persistent, CPU-friendly law and scope enforcement for AI agents.

Agent Buccet is the containment layer you add to the agent stack you already run.

The public repo is centered on the shared Buccet brain.
Optional deeper kernel-level nets can be added later for private or high-assurance deployments without changing that core model.

Core lines:
- Agents can propose. They cannot authorize.
- No ambient authority.
- No out-of-scope actions.
- No silent destructive tool use.

## Start Here

- [Agent Buccet README](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/README.md)
- [Quickstart](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/QUICKSTART.md)
- [Integrations](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/INTEGRATIONS.md)
- [Launch Boundary](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/LAUNCH_BOUNDARY.md)
- [Launch Proof](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/LAUNCH_PROOF.md)
- [Security Model](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/SECURITY_MODEL.md)
- [Current Limits](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/CURRENT_LIMITS.md)
- [Law Catalog](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/LAW_CATALOG.md)
- [Examples](/Users/ryangatoloai-faupula/lml_demo/docs/agent-boundary/examples/README.md)
- [Repo Boundary](/Users/ryangatoloai-faupula/lml_demo/docs/REPO_BOUNDARY.md)

## Hosted Install

Hosted-ready release assets are generated under `dist/releases/`.

Example hosted flow:

```bash
sh dist/releases/install.sh
buccet status
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
- `lib/lml/agent-boundary/`
- `scripts/agent-buccet-*`
- `scripts/buccet.ts`
- `scripts/install-agent-buccet.sh`
- `scripts/install-agent-buccet-hosted.sh`
- `scripts/prepare-agent-buccet-package.ts`
- `native/`
