# Repo Boundary

This repository is now staged as an `Agent Buccet` repo.

## First-Class Public Surface

The intended public Agent Buccet surface is:
- `docs/agent-boundary/`
- `lib/lml/agent-boundary/`
- `scripts/agent-buccet-*`
- `scripts/buccet.ts`
- `scripts/install-agent-buccet.sh`
- `scripts/prepare-agent-buccet-package.ts`

This is the boundary/runtime/install shell that should define the repo publicly.

## Retained Internal Staging Surface

The repo still contains older LML and app staging material under:
- `app/`
- broader `lib/lml/`
- `tests/`
- older root `docs/`
- `data/generated/`

These are retained for current development continuity.
They are not the primary public Agent Buccet surface.

## Working Rule

When cleaning or publishing this repo:
- keep the Agent Buccet surface first-class
- avoid expanding the public story with unrelated retained staging material
- treat retained staging surfaces as secondary unless explicitly promoted

## Current In-Progress Boundary

Still in progress for public release:
- hosted install path
- deepest OS/kernel interception layer
- final trimming of retained staging surfaces if needed
