# NOCR And UUIS Module Boundaries

Date: `2026-03-08`
Status: `Explicit module boundaries created`
Boundary: `Architectural alignment; no intended behavior change`

## UUIS

New module boundary:
- [lib/uuis/index.ts](/Users/ryangatoloai-faupula/lml_demo/lib/uuis/index.ts)
- [lib/uuis/encoder.ts](/Users/ryangatoloai-faupula/lml_demo/lib/uuis/encoder.ts)
- [lib/uuis/types.ts](/Users/ryangatoloai-faupula/lml_demo/lib/uuis/types.ts)

Purpose:
- make the UUIS encoder explicit as a first-class architecture boundary
- separate UUIS-facing imports from the lower-level `lib/snap` implementation

Current role:
- wraps the existing SNAP UUIS encoder
- exposes `encodeUuisEnvelope(...)`
- exposes `summarizeUuisEnvelope(...)`

## NOCR

New module boundary:
- [lib/nocr/index.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/index.ts)
- [lib/nocr/engine.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/engine.ts)
- [lib/nocr/types.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/types.ts)

Purpose:
- make NOCR explicit as the root/seed tagging and funnel boundary
- introduce typed root-space and seed-space concepts in code
- create a safe adapter layer over current routing/orchestration

Current role:
- defines root domains: `sun`, `ability`, `meta`, `human`, `quantum`
- creates typed seeds from current runtime requests
- tags seeds and roots for the funnel
- preserves typed root-space and seed-space inside the funnel
- leaves root/parent resolution to post-funnel `quantum collapse`

## Current Scope

These new boundaries are intentionally modest:
- they create explicit architecture seams
- they wrap current behavior rather than replacing it wholesale
- they allow later deeper runtime migration without another ontology rewrite

Current real execution use:
- coding candidate branch selection in `lib/demo/gpt2.ts` now projects branch seeds through `NOCR` quantum snap before execution order is chosen
- this replaces the earlier raw sequential queue walk with legality/alignment-first branch selection
- chat runtime now records `NOCR` funnel state separately from post-funnel `quantum collapse`

## Next Migration Step

1. move SNAP route imports to `lib/uuis`
2. move runtime route selection and trace alignment through `lib/nocr`
3. extend quantum snap beyond coding candidate selection into additional routing/orchestration paths where lawful
4. expand `NOCR` ledger types for seed/root/branch/tree/state change persistence
