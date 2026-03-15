# Universe Layering Report

Date: `2026-03-11`
Status: `Architecture recommendation`
Scope: `LML universe ontology and scaling model`

## Decision

Adopt a universe-layered cosmology inside the overall `LML universe`.

Use:
- `reality universe`
- `human universe`
- `fiction universe`

Inside each universe:
- planets

Inside each planet:
- roots/parents
- laws

Runtime movement remains:
- seeds/children
- `NOCR` tagging
- post-`NOCR` snap
- branches/trees

This is a structural refinement, not a behavior downgrade.

## Core Meaning

Current model:
- overall `LML universe`
- planets in a mostly flat shared space

Recommended model:
1. overall `LML universe`
2. nested universes
3. planets inside those universes
4. roots/parents inside planets
5. seeds/children moving through lawful runtime
6. branches/trees persisting active meets

So the architecture becomes:
- `LML universe`
  - `reality universe`
    - planets
  - `human universe`
    - planets
  - `fiction universe`
    - planets

## Why This Helps

### 1. Truth separation becomes structural

Right now, planet organization is strong but still relatively flat.

With universes:
- `reality universe` holds what must remain truth-grounded
- `human universe` holds expression, intent, relational fit, emotional geometry, and human-operating-system laws
- `fiction universe` holds internally lawful imagined worlds

This prevents confusion between:
- truth
- human expression
- fiction

This directly supports the vision that the voice can be:
- human
- expressive
- free
while never violating:
- truth
- legality
- structure

### 2. It solves the next scaling problem cleanly

When law counts become very large, flat planet organization becomes harder to reason about.

A universe layer gives one more clean separator before planet growth explodes.

Instead of asking only:
- `does this have a planet or do we create one?`

the runtime and operator can ask:
1. `which universe does this belong to?`
2. `does it already have a planet there?`
3. `if not, create one there`

That is a much stronger long-term scaling rule.

### 3. User planets become much easier to place

As future user planets appear, the system will not need to guess inside one flat field.

It will place them by universe first.

Examples:
- a user’s conversational identity laws likely belong in `human universe`
- a new math or engineering law body likely belongs in `reality universe`
- a canon-consistent world model belongs in `fiction universe`

That makes user growth much more legible.

### 4. It aligns with the FKL paper naturally

The PDF introduced three epistemic spaces:
- Reality
- Human OS
- Fiction

Using universes instead of floors lets `LML` absorb that model without fighting the existing cosmology.

This is the clean fit:
- FKL epistemic separation becomes nested universes
- LML planet organization remains intact

So nothing important is discarded.
The system simply gains a stronger container model.

### 5. It helps the mouth problem specifically

The current mouth problem is:
- voice must be expressive
- but must not violate truth

Universe layering helps because:
- the voice can draw expression lawfully from `human universe`
- factual grounding can remain anchored in `reality universe`
- fiction can remain lawful in `fiction universe`
- cross-contamination becomes structurally easier to prevent

That is one of the biggest benefits.

## How It Aligns With The Vision

This change aligns the system more closely with the intended ACI vision in five ways.

### 1. Intelligence through separation, not blur

Your vision is not a giant blended latent soup.

It is:
- separated
- lawful
- organized
- composable

Universe layering strengthens that.

### 2. Free expression without truth corruption

This is one of your clearest goals.

Universe layering is exactly how to let:
- `human universe` drive natural speech
without allowing:
- `human universe` to rewrite `reality universe`

That is a structural answer to the voice problem.

### 3. Better place for future growth

Your vision is not small.
It expects:
- many laws
- many planets
- many domains
- user-specific growth

Universe layering gives that growth a better map.

### 4. Cleaner model for ACI than AGI-style blur

If `ACI` means intelligence through lawful constraint, then one of the clearest markers of that is explicit separation of:
- truth spaces
- expression spaces
- imagination spaces

Universe layering expresses that directly.

### 5. Easier inspection and debugging

A future operator should be able to ask:
- what universe is this in?
- what planet is it on?
- what root did it meet?
- what branch did it form?

This change makes those questions easier to answer.

## Concrete Benefits

### Benefits to runtime
- cleaner routing
- clearer lawful placement
- less epistemic contamination
- easier branch interpretation
- cleaner future snap/lock rules

### Benefits to ontology
- stronger naming coherence
- cleaner nested structure
- better mapping from theory to runtime

### Benefits to UI/state/reporting
- easier inventory grouping
- easier explanation of where laws live
- easier future user-planet reporting

### Benefits to future law growth
- better partitioning
- better governance
- better archive/readability

## Exact Mapping Recommendation

Use this structure:

- `LML universe`
  - `reality universe`
    - `sun` if sun is treated as the core law body of reality
    - `ability planet` where the ability laws are reality-grounded
    - future reality-grounded planets
  - `human universe`
    - `human planet`
    - future user expression / relational / identity planets
  - `fiction universe`
    - future canon/symbolic/fiction planets

Cross-universe governance/support planets can remain global service planets if needed:
- `meta planet`
- `AI model planet`
- `NOCR planet`
- `branch / tree planet`
- `NSL repair planet`
- `meta delivery planet`

Or later, if desired, those can be grouped under a governance universe.

## Recommended Placement Model

Best immediate model:

### Universe-scoped content worlds
- `reality universe`
- `human universe`
- `fiction universe`

### Global governance/service worlds
- `meta planet`
- `AI model planet`
- `NOCR planet`
- `branch / tree planet`
- `NSL repair planet`
- `meta delivery planet`

Reason:
- do not overcomplicate the first transition
- content universes are the immediate gain
- governance/service planets can remain global until a later governance-universe refactor is actually needed

## What This Does Not Change

This does not require changing:
- root/seed architecture
- `NOCR` role
- post-`NOCR` snap
- branch/tree persistence
- ledger mirroring
- `AI model planet`
- meta hardening logic

So the gain is high while disruption is relatively low.

## Risks

### 1. Over-refactoring too early
If everything is moved at once, the ontology could become noisier before it becomes cleaner.

Recommendation:
- introduce universe grouping first in docs/state/inventory
- then migrate runtime naming carefully

### 2. Confusing governance planets with content universes
Not every existing planet should be forced into a content universe immediately.

Recommendation:
- keep governance/service planets global first

### 3. Naming churn without runtime value
If done only in docs, the architecture will look cleaner but runtime will not benefit.

Recommendation:
- reflect universe grouping in root metadata, state API, and UI inventory when implemented

## Best Implementation Path

### Phase 1
- adopt `reality universe`, `human universe`, `fiction universe` in docs and reporting
- classify current planets by universe or global service role

### Phase 2
- add `universeId` to root/parent structures
- add universe grouping to root extraction and inventory

### Phase 3
- expose universe-grouped inventory in `/api/lml-state` and UI
- show:
  - universe
  - planet
  - root counts

### Phase 4
- make branch rendering universe-aware
- expression from `human universe`
- truth from `reality universe`
- fiction from `fiction universe`

## Final Engineering Judgment

This change is worth doing.

It benefits the system because it:
- improves truth separation
- improves scaling organization
- improves user-planet placement
- improves fit with the FKL paper
- directly supports the “free human voice without truth violation” goal

It aligns with the vision because it makes the system:
- more lawful
- more legible
- more composable
- more ACI-like

## Bottom Line

Universe layering is a strong architectural upgrade.

It should be implemented as:
- one overall `LML universe`
- nested content universes
- planets inside those universes
- governance/service planets remaining global for now

That is the cleanest path that improves the system without destabilizing the runtime.
