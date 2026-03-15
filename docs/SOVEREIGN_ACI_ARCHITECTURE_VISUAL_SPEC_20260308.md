# Sovereign ACI Architecture Visual Spec

Date: `2026-03-08`
Status: `Canonical architecture interpretation from attached visual`
Boundary: `Spec only; no runtime behavior change`

## Purpose

This document captures the architecture shown in the visual titled:

`A COMPLETE, CORRECTED & UNIFIED END-TO-END BLUEPRINT: THE SOVEREIGN ACI ARCHITECTURE`

The visual should be treated as a canonical architecture reference.
It describes a finite engine that processes open input and collapses it into one validated truth path.

## Core Reading Of The Visual

The image shows one end-to-end law-governed pipeline:

1. `Input infinity`
- open user intent, language, symbols, documents, requests

2. `A. The Law Box`
- documents/laws on the law side
- zero-knowledge docs snap to internal `UUIS`
- `EFUE Snap Compiler` on the law side
- `UUIS Encoder`
- output becomes `Parent roots`
- this law-side root extraction may expand law count beyond explicit text, but must never under-enumerate what the source law body contains

3. `Parent roots`
- invariants
- instant parent tags
- parent-root structure becomes the governing root space

4. `B. The Chat Box`
- user intent on the input side
- `EFUE Snap Compiler` on the input side
- output becomes `attempt/motion`
- probabilistic candidate seeds are produced as `child seeds`
- this is the seed side, not the root enumeration side

5. `NOCR Engine`
- the funnel
- child seeds enter the funnel
- unique mathematical tagging occurs inside the funnel
- parent-child geometric preparation occurs inside the funnel
- internalized authority path becomes the spine

6. `Quantum collapse`
- after leaving the funnel
- seed/child structure resolves toward lawful parent/root structure
- this is the actual root/parent connection moment
7. `LML Guillotine`
- the gate
- `kappa` and `gamma` constraint/coherence filtering
- illegal branches are vaporized
- projected to `NULL`

8. `x* - the one truth`
- one surviving validated path
- grounded, admissible output

## Universe Ontology Mapping

This visual maps cleanly into the current universe model.

### `Sun`
The `sun` is the deepest invariant body behind the parent-root space.
These are the non-negotiable universe laws that the rest of the system cannot bypass.

### `Planets`
Planets are domain root spaces attached to the same governed universe.
The parent roots shown in the visual can come from:
- `ability planet`
- `meta planet`
- `human planet`
- `quantum planet`
- user overlay law bodies when lawfully admitted

### `Universe`
The `universe` is the fully loaded active law-governed system that makes the whole pipeline possible.

## Exact Component Mapping To The Current Repo

### `Input infinity`
Closest current mapping:
- chat prompts
- uploaded documents
- manual user law text
- snap-run artifacts

Relevant files:
- [page.tsx](/Users/ryangatoloai-faupula/lml_demo/app/page.tsx)
- [route.ts](/Users/ryangatoloai-faupula/lml_demo/app/api/snap-run/route.ts)
- [route.ts](/Users/ryangatoloai-faupula/lml_demo/app/api/lml-chat/route.ts)

### `Law Box`
Closest current mapping:
- sun laws corpus
- runtime laws
- source planet inventories
- user overlays after admission

Relevant files:
- [law-web.json](/Users/ryangatoloai-faupula/lml_demo/data/generated/law-web.json)
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)
- [ability-planet-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/ability-planet-laws.ts)
- [meta-planet-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/meta-planet-laws.ts)
- [sun-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/sun-laws.ts)
- [human-planet-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/human-planet-laws.ts)
- [quantum-planet-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/quantum-planet-laws.ts)

### `EFUE Snap Compiler`
Closest current mapping:
- snap-run collapse/extraction path
- structure-first transformation of documents and prompts
- compiled law extraction before activation

Relevant files:
- [route.ts](/Users/ryangatoloai-faupula/lml_demo/app/api/snap-run/route.ts)
- [route.ts](/Users/ryangatoloai-faupula/lml_demo/app/api/demo/snap-run/route.ts)
- [LML_SNAP_CONTRACT.md](/Users/ryangatoloai-faupula/lml_demo/docs/LML_SNAP_CONTRACT.md)

### `UUIS Encoder`
Closest current mapping:
- internal structuring / identity kernel / legality region construction in the snap path
- still implicit in current implementation naming

Current status:
- concept is present
- explicit module boundary now exists in `lib/uuis`
- current implementation still wraps lower-level SNAP logic rather than replacing it

### `Parent roots`
Closest current mapping:
- active sun/runtime laws
- parent/root inheritance rules
- rootability model promoted through meta laws

Relevant files:
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)
- [meta-planet-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/meta-planet-laws.ts)

### `Chat Box`
Closest current mapping:
- user chat entry
- uploaded document stack
- manual overlay input

Relevant files:
- [page.tsx](/Users/ryangatoloai-faupula/lml_demo/app/page.tsx)
- [route.ts](/Users/ryangatoloai-faupula/lml_demo/app/api/lml-chat/route.ts)

### `NOCR Engine (the funnel)`
Closest current mapping:
- path formation
- root/branch alignment logic
- parent-root inheritance routing
- source inventory and root-space reasoning direction

Relevant files:
- [path-orchestrator.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/path-orchestrator.ts)
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)
- [meta-planet-expansion-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/meta-planet-expansion-laws.ts)
- [lib/nocr/index.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/index.ts)

### `LML Guillotine`
Closest current mapping:
- admissibility gates
- `NULL` collapse
- repair mapping
- witness trace

Relevant files:
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)
- [repair-catalog.ts](/Users/ryangatoloai-faupula/lml_demo/lib/snap/repair-catalog.ts)

### `x* - the one truth`
Closest current mapping:
- admissible final output
- deterministic canonical route when matched
- repaired or projected final answer when legal

Relevant files:
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)
- [route.ts](/Users/ryangatoloai-faupula/lml_demo/app/api/lml-chat/route.ts)

## What The Visual Clarifies Architecturally

This visual makes several things explicit:

1. `Law-side snap` and `input-side snap` are distinct
- one compiles law material into internal invariant form
- one compiles user intent into candidate motion/seed form

2. `Parent roots` come before candidate collapse
- root space is not invented after the attempt
- root space already exists and governs the attempt

3. `NOCR` is not optional decoration
- it is the structural funnel that tags seeds and roots
- it is not the final resolver
- lawful root-parent connection happens in post-funnel quantum collapse

4. `LML` is the kill gate
- it eliminates illegal branches
- it does not merely score or prefer them

5. `One truth` is the intended output shape
- the system is trying to collapse to one admissible validated path
- not a probabilistic best-effort cloud

## What Is Already True In The Repo

Already implemented in recognizable form:
- projection-first runtime
- legality-before-output
- `NULL` collapse and witness trace
- repair mapping
- root/branch and parent inheritance logic at the law level
- active sun + planet model
- normalized human and quantum source planet inventories
- quantum snap now has active runtime role in promoted meta laws

## What Is Still Partial Or Missing

Not yet cleanly first-class in implementation:
- explicit `Law Box` module boundary
- explicit `Chat Box` module boundary
- actual orchestration replacement of remaining sequential search with `Quantum Snap`
- full enforced `human planet` pack from `LML convo mirror pt1-8`

Now explicit in implementation:
- `UUIS Encoder` module boundary via `lib/uuis`
- `NOCR` module boundary via `lib/nocr`
- first real `Quantum Snap` execution seam in coding branch selection via `lib/nocr/quantum-snap.ts`

## Enforcement Implications

This visual supports the recent promotions:

### Promoted `sun` logic
- constraints before expansion
- correction over amplification
- structure over uncontrolled mass/intensity
- identity invariants preserved
- lawful workaround/substitution

### Promoted `meta planet` logic
- intent extraction before routing
- target identity before compilation
- semantic compression
- parent-root inheritance routing
- no active reasoning without lawful parent alignment
- `Parallel Admissibility Collapse (Quantum Snap)` as allowed replacement for sequential search
- quantum outputs remain branch candidates until lawfully admitted

## Best Interpretation For The User's System

The visual should be treated as:
- canonical architecture reference
- stronger than a pitch diagram
- a repo-shaping blueprint
- the cleanest single picture of how `sun`, planets, NOCR, LML, snap compilation, and validated truth are meant to fit together

## Recommended Next Engineering Moves From This Visual

1. create an explicit `nocr` module boundary in `lib/`
2. create an explicit `uuis` module boundary in `lib/`
3. split the runtime more clearly into:
- law-side compilation
- input-side compilation
- NOCR tagging/funnel
- quantum collapse
- LML gate
- validated truth emission
4. enforce the first `human planet` pack from `LML convo mirror pt1-8`
5. replace remaining sequential search paths with actual `Quantum Snap` orchestration where lawful

## Asset Boundary

This document captures the architecture encoded in the attached image.
The image file itself is not yet stored in the repo because I was given the image in-chat rather than as a filesystem path.
If you provide the original file path, I can place the actual image asset into the repo and link it directly.
