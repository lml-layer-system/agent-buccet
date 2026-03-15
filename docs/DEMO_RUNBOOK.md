# Demo Runbook

## Universe Ontology
- `Sun` = sun law body
- `Ability planet` = the planet that holds ability laws
- `Meta planet` = the planet that holds meta laws
- `Universe` = the full boot-loaded system
- Active manifest path: `data/generated/canonical-planet-manifest.json`

## Archive Boundary
- `handoff/` is archived reference material only
- never run `handoff/` artifacts as part of demo boot or runtime
- only active app/lib/scripts/data inputs belong in the live demo path

## Prerequisites
- Node 20+
- npm
- Docker engine (optional, for containerized run)

## Preferred Run (No Container)
1. `npm install`
2. `npm run compile:web`
3. `npm run demo:check`
4. `npm run dev`

Demo URL: `http://localhost:3000`

## Container Run With Colima
1. Install/start Colima and Docker CLI.
2. Verify context exists: `docker context ls`
3. Start demo: `npm run demo:up:colima`
4. Open `http://localhost:3000`
5. Stop demo: `npm run demo:down:colima`

## Generic Container Run
1. `npm run demo:up`
2. Open `http://localhost:3000`
3. Stop with `npm run demo:down`

## Required Preflight
`npm run demo:check` must pass:
- canonical planet manifest present and valid
- universe freeze invariants match
- API readiness passes

## Troubleshooting
- If startup fails, run:
- `npm run verify:freeze`
- `npm run verify:web`
- `npm run verify:snap`
- If freeze fails, do not proceed until sun/universe artifacts are restored.
- If Colima context is missing, create/start it first, then retry `npm run demo:up:colima`.
