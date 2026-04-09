# Agent Buccet Release Checklist

Use this before flipping the repo public.

## One-Command Lock Gate

If you want the full locked posture in one shot, run:

```bash
npm run check:agent-buccet:production
```

Alias:

```bash
npm run check:agent-buccet:locked
```

This gate covers:
- typecheck
- artifact/doc hygiene
- stable contract lane
- package build
- CLI surface
- path runtime
- release/package surfaces
- install and hosted-install flows

Deep runtime proof remains available as a separate explicit check:

```bash
npm run check:agent-buccet:runtime-deep
```

That keeps the production lock gate deterministic while still preserving the hook runtime contract as a harder operational proof.

For an installed machine-level posture check, run:

```bash
buccet doctor --strict
```

`--strict` fails closed if the install is not initialized, the native layer is missing, the hook daemon is down, the intercept socket is unreachable, or the ledger chain is not healthy.

## CI Gate

These are the checks the current CI gate actually runs.

Blocking lane:

```bash
npm run typecheck
npm run check:agent-buccet:p0
npm run check:agent-buccet:contracts-stable
```

Confirm:
- the blocking lane passes deterministically
- `check:agent-buccet:contracts-stable` covers:
  - `test:agent-buccet:gravity-contract`
  - `test:agent-buccet:ledger-contract`
  - `test:agent-buccet:wrapper-contract`
  - `test:agent-buccet:intercept-daemon`
  - `test:agent-buccet:release-witness`

Observed lane:

```bash
npm run check:agent-buccet:contracts-observed
```

Confirm:
- observed report is written to `artifacts/observed-contracts/report.json`
- swarm and intercept-server pass-rate metrics are visible
- logs are written under `artifacts/observed-contracts/`
- promotion threshold remains `>= 0.99` across rolling runs before moving either test into the blocking lane

Observed is non-blocking initially.
It is still required operationally: failures must stay visible and tracked until promoted or fixed.

## Release Packaging Verification

Run:

```bash
npm run build
npm run test:agent-buccet:cli
npm run test:agent-buccet:install
npm run test:agent-buccet:hosted-install
npm run check:agent-buccet:runtime-deep
```

Confirm:
- `dist/agent-buccet/` is generated
- `dist/releases/` is generated
- `dist/releases/latest.json` includes a `witness` block
- `dist/releases/witness/status.json` exists
- install and hosted-install flows still work end to end

## Witness Posture

Release witness publication is default-on.

Default release flow:
- publish a signed checkpoint witness during packaging
- write audit state under `dist/releases/witness/`
- include witness metadata in `dist/releases/latest.json`

Break-glass path:

```bash
AGENT_BUCCET_WITNESS_REQUIRED=false \
AGENT_BUCCET_WITNESS_OPT_OUT_REASON="<why>" \
npm run build
```

Confirm:
- witness publication is present by default
- skipping witness requires explicit opt-out
- opt-out leaves a breadcrumb in `dist/releases/witness/status.json`

## Public Surface Check

Confirm the top-level repo still reads as:
- Agent Buccet first
- one shared Buccet brain
- deeper kernel-level nets are deployment depth, not the public core

Confirm these docs are present and current:
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
- default-on release witness publication with explicit break-glass opt-out

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
- no unrelated non-Buccet material is present

## Flip Public

When the checks above are green:
- push the final release candidate commit
- make the repo public
- publish the hosted release assets
- keep the first public announcement inside the documented claim boundary
