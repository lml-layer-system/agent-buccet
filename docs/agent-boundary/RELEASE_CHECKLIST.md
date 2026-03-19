# Agent Buccet Release Checklist

Use this before flipping the repo public.

## Core Verification

Run:

```bash
npm run lint
npm run build
npm run test:agent-buccet:cli
npm run test:agent-buccet:install
npm run test:agent-buccet:hosted-install
npm run test:agent-buccet:gravity-contract
npm run test:agent-buccet:ledger-contract
npm run test:agent-buccet:hook-runtime
npm run test:agent-buccet:swarm
```

Confirm:
- all commands pass
- `dist/agent-buccet/` is generated
- `dist/releases/` is generated

## Public Surface Check

Confirm the top-level repo still reads as:
- Agent Buccet first
- one shared Buccet brain
- optional deeper kernel-level nets, not the public core

Confirm these docs are present and current:
- `README.md`
- `docs/agent-boundary/README.md`
- `docs/agent-boundary/QUICKSTART.md`
- `docs/agent-boundary/LAUNCH_BOUNDARY.md`
- `docs/agent-boundary/LAUNCH_PROOF.md`
- `docs/agent-boundary/SECURITY_MODEL.md`
- `docs/agent-boundary/CURRENT_LIMITS.md`

## Claim Discipline

Safe claims:
- add-on containment layer
- shared Buccet brain
- freeze-and-forward hook path
- signed inspectable ledger
- swarm support through one decision core
- optional witness support

Do not claim:
- full kernel mediation on every OS path
- impossible bypass on all platforms
- independent external attestation by default

## Install Check

Hosted-ready flow:

```bash
sh dist/releases/install.sh
buccet status
buccet scope add .
buccet run -- /bin/echo protected
buccet logs
buccet uninstall
```

Confirm:
- install succeeds
- first-run flow is understandable
- uninstall removes the local shell cleanly

## Repo Hygiene

Confirm:
- `git status --short` is clean
- no local runtime debris is staged
- no unrelated private material is present

## Flip Public

When the checks above are green:
- push the final private commit
- make the repo public
- publish the hosted release assets
- keep the first public announcement inside the documented claim boundary
