# Repo Boundary

This repository is an `Agent Buccet` repo.

## First-Class Surface

The intended public surface is:
- `docs/agent-boundary/`
- `lib/lml/agent-boundary/`
- `scripts/agent-buccet-*`
- `scripts/buccet.ts`
- `scripts/install-agent-buccet.sh`
- `scripts/install-agent-buccet-hosted.sh`
- `scripts/prepare-agent-buccet-package.ts`
- `native/`

This is the boundary runtime, install shell, packaging layer, and contract surface.

## Working Rule

When changing this repo:
- keep the Agent Buccet surface first-class
- do not reintroduce unrelated framework, app, or universe baggage
- treat this repo as the future public Agent Buccet repo, not a staging area for broader LML work

## Current In-Progress Boundary

Still in progress for public release:
- deepest OS/kernel interception layer
- public hosting of the generated release assets
