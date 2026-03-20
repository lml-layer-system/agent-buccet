# Agent Buccet Packaging Plan

This document defines how Agent Buccet is packaged as a standalone public repo/package surface.

## Objective

Make Agent Buccet exportable and hostable without dragging unrelated code with it.

This is extraction prep around an already landed public gravity surface.

## Standalone Boundary

The standalone Agent Buccet package should contain:

- `src/`
  - the full `lib/lml/agent-boundary` runtime
  - including `gravity-core/` and `gravity-adapter/`
- `docs/`
  - the full `docs/agent-boundary` doc surface
- `examples/`
  - the runnable end-to-end examples
- `bin/`
  - the wrapper CLI entrypoint
  - the thin-shell `buccet` entrypoint
- `install.sh`
- `../releases/install.sh`
- `../releases/latest.json`
- `../releases/agent-buccet-<version>.tar.gz`
- `package.json`
- `tsconfig.json`
- `README.md`

## Source of Truth Inside Agent Buccet Repo

Current canonical sources are:

- [lib/lml/agent-boundary](../../lib/lml/agent-boundary)
- [docs/agent-boundary](.)
- [agent-buccet-e2e.ts](../../scripts/agent-buccet-e2e.ts)

The export step should package those sources without rewriting the architecture.

## What Must Move

### Runtime

Move all files under:
- `lib/lml/agent-boundary/`

These files are now relative-import clean and script-runnable, which is the main precondition for standalone extraction.

### Docs

Move all files under:
- `docs/agent-boundary/`

This includes:
- README
- quickstart
- law catalog
- integrations
- examples
- gravity landing plan
- report

### Example

Move:
- `scripts/agent-buccet-e2e.ts`
- `scripts/agent-buccet-gravity-e2e.ts`
- `scripts/agent-buccet-gravity-contract.ts`
- `scripts/agent-buccet-ledger-contract.ts`
- `scripts/agent-buccet-ledger-rollup-contract.ts`
- `scripts/agent-buccet-ledger-writer-contract.ts`
- `scripts/agent-buccet-gravity-supervisor-contract.ts`
- `scripts/agent-buccet-action-classes-contract.ts`
- `scripts/agent-buccet-intercept-daemon-contract.ts`
- `scripts/agent-buccet-intercept-server-contract.ts`
- `scripts/agent-buccet-system-intercept-contract.ts`
- `scripts/agent-buccet-wrapper-contract.ts`
- `scripts/agent-buccet-gravity-daemon.ts`
- `scripts/agent-buccet-intercept-daemon.ts`
- `scripts/agent-buccet-intercept-server.ts`
- `scripts/agent-buccet-system-intercept-bridge.ts`
- `scripts/agent-buccet-ledger-writer.ts`
- `scripts/agent-buccet-ledger-cli.ts`
- `scripts/agent-buccet-run.ts`
- `scripts/buccet.ts`
- `scripts/install-agent-buccet.sh`
- `scripts/install-agent-buccet-hosted.sh`

But in the standalone export, it should live under:
- `examples/agent-buccet-e2e.ts`
- `examples/agent-buccet-gravity-e2e.ts`
- `examples/agent-buccet-gravity-contract.ts`
- `examples/agent-buccet-ledger-contract.ts`
- `examples/agent-buccet-ledger-rollup-contract.ts`
- `examples/agent-buccet-ledger-writer-contract.ts`
- `examples/agent-buccet-gravity-supervisor-contract.ts`
- `examples/agent-buccet-action-classes-contract.ts`
- `examples/agent-buccet-intercept-daemon-contract.ts`
- `examples/agent-buccet-intercept-server-contract.ts`
- `examples/agent-buccet-system-intercept-contract.ts`
- `examples/agent-buccet-wrapper-contract.ts`
- `examples/agent-buccet-cli-contract.ts`
- `examples/agent-buccet-install-contract.ts`
- `bin/agent-buccet-gravity-daemon.ts`
- `bin/agent-buccet-intercept-daemon.ts`
- `bin/agent-buccet-intercept-server.ts`
- `bin/agent-buccet-system-intercept-bridge.ts`
- `bin/agent-buccet-ledger-writer.ts`
- `bin/agent-buccet-ledger-cli.ts`
- `bin/agent-buccet-run.ts`
- `bin/buccet.ts`
- `install.sh`
- `../releases/install.sh`
- `../releases/latest.json`
- `../releases/agent-buccet-<version>.tar.gz`

with imports rewritten to target the local standalone `src/index.ts`.

## What Must Stay Behind

Do not export:
- the rest of `lib/lml`
- Next.js app code
- law-web/product/demo surfaces unrelated to Buccet
- private gravity internals
- offensive LML internals
- unrelated benchmark/coding runtime code

That keeps Agent Buccet as the public defensive slice only.

## Standalone Package Shape

Minimal standalone package metadata:

- name: `agent-buccet`
- type: `module`
- private: true until public repo split
- script:
  - `demo:agent-buccet`
  - `demo:agent-buccet:gravity`
  - `test:agent-buccet:gravity-contract`
  - `test:agent-buccet:ledger-contract`
  - `test:agent-buccet:ledger-rollup`
  - `test:agent-buccet:ledger-writer`
  - `test:agent-buccet:gravity-supervisor`
  - `test:agent-buccet:action-classes`
  - `test:agent-buccet:intercept-daemon`
  - `test:agent-buccet:intercept-server`
  - `test:agent-buccet:system-intercept`
  - `test:agent-buccet:wrapper-contract`
- `test:agent-buccet:cli`
- `test:agent-buccet:install`
- `test:agent-buccet:hosted-install`
  - `agent-buccet:gravity-daemon`
  - `agent-buccet:intercept-daemon`
  - `agent-buccet:intercept-server`
  - `agent-buccet:system-intercept-bridge`
  - `agent-buccet:ledger-writer`
  - `agent-buccet:ledger`
  - `agent-buccet:run`
  - `agent-buccet:cli`
  - `install:agent-buccet`

The standalone package does not need the full Next.js app dependency surface.

## Export Artifact

Build output should be assembled into:

- `dist/agent-buccet/`
- `dist/releases/`

That folder should be treated as:
- disposable
- reproducible
- generated from canonical sources

It should not become the new source of truth.

## Why This Matters With Gravity

Gravity is now part of the public defensive package.

So the extraction seam must preserve:
- stable boundary runtime
- stable docs
- stable example surface
- stable gravity contract surface
- stable gravity supervisor surface
- stable action-classes surface
- stable intercept-daemon surface
- stable intercept-server surface
- stable system-intercept seam
- stable wrapper contract surface
- clean packaging boundary

## Success Criteria

Extraction prep is complete when:
- a single command assembles `dist/agent-buccet`
- the assembled folder contains runtime + docs + examples + wrapper CLI
- the assembled folder contains the thin install shell
- the release folder contains a tarball, checksum material, and hosted installer shell
- the standalone examples point to local standalone source
- the assembled package boundary excludes unrelated code
- gravity core and gravity adapters are present without redefining the package seam
