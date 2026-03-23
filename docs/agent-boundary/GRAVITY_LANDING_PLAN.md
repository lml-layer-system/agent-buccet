# Agent Buccet Gravity Landing Plan

This document now records the landed gravity shape and the remaining deeper integration work.

## Principle

Gravity landed last.

It does not replace:
- law
- scope
- approval
- ledger
- session lifecycle
- shared bodyguard boundary path

It now reinforces them as a no-leak field on the Bodyguard path.

## What Gravity Is

Gravity is the continuous Agent Buccet enforcement field.

Its job is:
- detect unlawful motion
- collapse unlawful motion to `null`
- ledger the collapse
- route recovery through Bodyguard
- allow lawful re-entry only

This is not just denial.
This is no-leak containment.

## What Gravity Must Attach To

Gravity should attach to the stable public boundary spine:

1. persistent session state
2. grants and path-law state
3. ledger state
4. shared Bodyguard proposals
5. Bodyguard recovery output

It should sit below framework adapters and below surface-specific wrappers.

## What Gravity Must Not Replace

Gravity should not replace:
- `createBoundaryBodyguard(...)`
- `createPersistentBoundaryRuntimeStore(...)`
- approval handlers
- policy loading
- integration wrappers for NeMo / OpenAI Agents / LangGraph / Telegram

Those remain the operational boundary surface.

Gravity strengthens the lawful field under them.

## Landed Shape

The public defensive gravity core is now vendored under:
- [gravity-core](../../lib/agent-buccet/gravity-core)

The Agent Buccet adapter layer now lives under:
- [gravity-adapter](../../lib/agent-buccet/gravity-adapter)

The shared bodyguard attaches one gravity service to the shared store:
- [bodyguard.ts](../../lib/agent-buccet/bodyguard.ts)

## Required Mappings

### Boundary state -> gravity state

Need a stable mapping for:
- session id and status
- active grants
- active path laws
- relevant policy/law inventory
- ledger completeness state

### Bodyguard proposal -> gravity proposal

Every action proposal entering the shared Bodyguard path must have a gravity-side representation with:
- action kind
- target
- provenance
- meta-law flags
- session identity

### Ledger audit -> gravity ledger view

Gravity should not invent ledger trust or turn witness history into live authorization.

## No-Leak Rule

If gravity detects unlawful motion:
- do not let it continue internally
- do not leave it as live state
- do not downgrade it to a soft warning

Instead:
- collapse to `null`
- ledger the collapse
- surface NSL recovery

That is the defining behavior.

## Runtime Surface Split

Current Agent Buccet runtime surface:
- defensive meta laws
- ledger law
- session law
- scope law
- approval law
- boundary enforcement

Deeper gravity layers:
- stronger corrective/nulling behavior
- higher-order reconciliation machinery
- supervisor/restart strategy beyond the current seam
- additional containment extensions beyond current runtime scope

## Completion Criteria

Gravity is correctly landed when:
- unlawful motion is nulled instead of lingering
- incomplete ledger traces tighten the bucket automatically
- NSL becomes the lawful recovery path after null-collapse
- the same bodyguard model still works across all integrations
- gravity does not turn Agent Buccet into a new agent framework

## Current Public Contract

Current public proof surfaces are:
- [agent-buccet-gravity-e2e.ts](../../scripts/agent-buccet-gravity-e2e.ts)
- [agent-buccet-gravity-contract.ts](../../scripts/agent-buccet-gravity-contract.ts)

Contract command:

```bash
npm run test:agent-buccet:gravity-contract
```

This proves:
- out-of-scope -> `nsl_grant_offer`
- authority claim -> `deny`
- missing ledger history does not become live authorization deny

## What Still Remains Deeper

The remaining deeper gravity work is:
- stronger corrective state reconciliation beyond current public normalization
- richer per-request ledger completeness semantics
- daemon/supervisor orchestration beyond the current public seam
- additional containment internals beyond current runtime scope

That is the remaining deeper side. The Bodyguard-integrated no-leak gravity path is now in place.

Public supervisor note:
- restart/heartbeat are handled by the supervisor layer
- meta laws remain enforcement logic, not process-management logic
