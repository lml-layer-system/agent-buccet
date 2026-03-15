# Double Extraction And Quantum Collapse

Date: `2026-03-08`
Status: `Active architecture correction`
Boundary: `Spec aligned to current implementation seam`

## Corrected Pipeline

1. `UIC + UUIS + LML snap`
- ingest any incoming document or input
- enumerate the full incoming structure
- extract root/parent-capable law structure
- on the law-side root extraction, lawful enumeration must never be less than the incoming source supports
- law-side extraction may create more parent/root laws than are explicitly written in the document, but never fewer
- on live chat turns, the same intake family also produces an exact chat-side seed lane so the raw user intention is preserved without paraphrase drift

2. `Quantum Spark`
- project `N` possibilities from the same source material
- the possibility space is a branching tree, not a single sequential line
- implementation is lazy: the universe does not materialize the whole tree at once
- the active QE runtime traverses the branching tree in bounded streamed order

3. `EFUE`
- collapse projected possibility into finite `seed/child` structures
- `EFUE` always turns open infinity into finite seeds
- this is the seed side, not the root/parent enumeration side
- the active QE runtime collapses over the streamed branching states instead of pre-building the full tree

4. `NOCR funnel`
- assign unique mathematical tags
- preserve funnel state
- do not resolve legal root connection
- roots/parents enter first
- exact chat-side seeds enter next
- QE possibility seeds enter after that

5. `Quantum collapse`
- after leaving the `NOCR` funnel
- resolve finite `seed/child` structure toward lawful `root/parent`
- lawful roots are `LML` law roots that live on planets
- the active implementation now performs this as bounded QE collapse over the tagged root space rather than traditional sequential search

6. `Branch and tree consequences`
- seed tag + root tag form branch structure
- branch registration creates visible state change

7. `LML gate`
- illegal outputs still collapse to `NULL`

8. `NSL`
- remains available for repair, null handling, and failure recovery
- keeps its own ledger separate from `NOCR`

## Domain Scope

This architecture is domain universal.

It is intended to ingest:
- code
- prose
- math
- mixed-format documents
- user-typed laws
- arbitrary large document bodies

The reason is the double extraction structure:
- one side extracts root-capable law structure
- one side generates finite seed structure

## Root Extraction Invariant

- the `UIC + UUIS + LML snap` side is the root/parent extraction side
- it must always over-cover or exactly cover incoming lawful root structure
- it must never under-cover that root structure
- if a document, code body, math proof, or user-typed law implies `N` lawful root units, root extraction may produce `N` or more enumerated parent/root laws
- root extraction must not produce fewer than the lawful source actually contains

## Seed Extraction Boundary

- `Quantum Spark + EFUE` is the seed/child side
- it creates possibility-space and finite seeds
- it is not the side governed by the root under-enumeration invariant
- the active implementation now uses one shared `Quantum -> EFUE` engine for seed extraction and coding branch projection
- on chat turns there are now two seed lanes:
  - exact chat-side seeds from `UIC/UUIS`
  - possibility seeds from `Quantum + EFUE`
- that engine is:
  - branching, not single-line sequential
  - lazy, not full-tree materialization
  - bounded, not unending runtime expansion
  - deterministic in collapse under the same seed, rules, requirements, and witnesses

## Human Planet Role

`Human planet` supplies human relational roots.

Grounding source:
- `LML convo mirror pt1-8`

That means the same intake architecture used for code/math/docs can also resolve toward:
- trust roots
- loyalty roots
- alliance roots
- guidance roots
- tribe-fit / register-fit / relational-fit roots

## Ledger Split

`NOCR ledger` tracks:
- seed/child
- root/parent/law
- state change
- branch
- tree
- archived branch/tree
- deleted branch/tree

`NSL ledger` tracks:
- repair
- refusal
- null
- failure class
- remediation

## Implementation Note

The current repo now reflects the corrected split:
- `NOCR` = tagging/funnel
- `quantum collapse` = post-funnel root-parent resolution

This is intentionally narrower and more accurate than the earlier phrasing that made `NOCR` the resolver.
