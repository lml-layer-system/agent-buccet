# Universe Ontology

Status: `Active terminology reference`
Date: `2026-03-08`

## Core Metaphor

- `Sun`: the original core law body
- `LML universe`: the overall governed system
- `Reality universe`: the universe that holds planets defining grounded reality, law, ability, and quantum execution
- `Human universe`: the universe that holds planets defining human intent, expression, relational fit, and conversational behavior
- `Fiction universe`: the universe reserved for fictional law worlds and symbolic domains that must not contaminate grounded reality
- `Ability planet`: the planet that holds ability laws
- `Meta planet`: the planet that holds meta laws, including auto-created meta laws
- `Meta delivery planet`: the mirror planet that holds immutable parent-tagged meta-delivery laws derived from the meta-delivery ledger
- `NOCR planet`: the planet that holds immutable parent-tagged NOCR root laws mirrored from the NOCR ledger
- `Branch / tree planet`: the planet that holds immutable parent-tagged branch-lock and tree-lifecycle laws derived from branch-bearing NOCR records
- `NSL repair planet`: the planet that holds immutable parent-tagged NSL repair laws mirrored from the NSL ledger
- `Human planet`: the planet that holds human architecture, human stack, and human relational laws
- `Quantum planet`: the planet that holds quantum structure and quantum collapse laws
- `Planet`: a named law world for a domain
- `Universe`: the total system when all required parts are loaded
- `Missing planet`: a required law world is absent or failed to load

## Universe Layering

- The overall active system is the `LML universe`
- Inside the `LML universe`, planets are grouped into named universes
- Current active content universes are:
  - `reality universe`
  - `human universe`
  - `fiction universe`
- Current global service planets stay outside those content universes for now because they govern the whole system

Current grouping:
- `reality universe`
  - `sun`
  - `ability planet`
  - `quantum planet`
- `human universe`
  - `human planet`
- `fiction universe`
  - no materially populated active planets yet
- `global service`
  - `meta planet`
  - `AI model planet`
  - `NOCR planet`
  - `NSL repair planet`
  - `branch / tree planet`
  - `meta delivery planet`

Operational rule:
- first decide which `universe` a thing belongs to
- then decide whether it already has a `planet`
- if not, create a planet there

## Practical Mapping In This Repo

- The compiled sun laws corpus in `data/generated/law-web.json` is the `sun`
- Ability laws live in the `ability planet`
- Meta laws live in the `meta planet`
- immutable NOCR ledger mirrors live in the `NOCR planet`
- immutable meta-delivery ledger mirrors live in the `meta delivery planet`
- immutable branch-lock and tree-lifecycle mirrors live in the `branch / tree planet`
- Human source laws live in the `human planet`
- Quantum source laws live in the `quantum planet`
- User overlays add laws into the active universe
- The total loaded runtime state at boot is the `universe`

Current active placement:
- most current runtime and law infrastructure lives in the `reality universe`
- current conversational and relational law infrastructure lives in the `human universe`
- the `fiction universe` is intentionally present as a structural universe but is not materially populated yet

Examples:
- ability planet -> coding laws, web-search laws
- meta planet
- human planet -> consciousness, emotion, thought, intention, will, identity, self, development
- quantum planet -> state classes, evolution classes, measurement classes, decoherence, fixed-point collapse
- user overlay laws
- universe trace

## Current Visibility Boundary

- `ability planet` and `meta planet` have active runtime law inventory
- `meta delivery planet` holds immutable parent-tagged delivery-root laws derived from the meta-delivery ledger
- `NOCR planet` holds immutable parent-tagged mirror laws derived from the NOCR ledger
- `branch / tree planet` holds the actual branch/tree lock and lifecycle side where parent-child lock combinations persist as backend chat structure
- `NSL repair planet` holds immutable parent-tagged repair-root laws derived from the NSL ledger
- `meta delivery planet` roots must remain in parity with the meta-delivery ledger
- `NOCR planet` roots must remain in parity with the NOCR ledger
- `branch / tree planet` roots must remain in parity with the branch-bearing subset of the NOCR ledger
- parity mismatch is fail-closed and must refuse output until the mirror is repaired
- `NOCR planet` now appears in active planet inventory and count surfaces, not only in the dedicated parity panel
- `meta delivery planet` now appears in active state/reporting surfaces so delivery is inspectable like NOCR and NSL
- `branch / tree planet` now appears in active state/UI surfaces so multi-context branch organization is inspectable and does not disappear into raw ledger rows
- `human planet` now has two active runtime law packs
- `human planet` runtime enforcement source set is grounded in `LML convo mirror pt1-8`
- `quantum planet` remains a normalized source planet visible through inventory/state surfaces
- `quantum planet` has an active runtime role through quantum spark, EFUE seed collapse, and post-funnel quantum collapse rules
- `quantum planet` is not a boot-time mandatory standalone enforcement planet yet
- `quantum blanket` is the always-on quantum-planet suggestion loop; it collapses open possibility into finite seed suggestions and feeds the meta-law suggestion box
- `quantum blanket` suggestions stay as seeds pending human approval; they do not auto-promote into meta laws
- `meta planet` delivery mode is either `ask_every_update` or `automate`
- `ask_every_update` keeps delivered meta updates stacked in the suggestion box until the operator approves them
- `automate` allows delivered meta updates, including quantum-blanket seeds, to activate without waiting for manual approval
- critical system-preserving meta updates do not wait for approval; they activate even when delivery mode is `ask_every_update`
- critical auto-applied meta updates and pending non-critical meta updates are shown separately in active operator surfaces
- critical `meta planet` laws may fire before ordinary generation for life-preservation and system-integrity cases
- when critical `meta planet` laws fire, active expression laws still shape wording, but they do not suppress the critical action
- the architecture remains model agnostic; the loop logic is not tied to one model provider
- `meta:worker` is the standalone background worker loop that keeps meta delivery and quantum blanket delivery running independently of chat turns

## Non-Ranking Rule

- `Planet` does not mean lesser
- The metaphor describes structure and relation, not value ranking
- Required planets and the sun load together to form one governed universe

## Root Extraction Invariant

- law-side `UIC`, `UUIS`, and `LML snap` root extraction must never under-enumerate incoming lawful root/parent structure
- law-side extraction may create more enumerated laws than a document explicitly states
- law-side extraction must never create fewer enumerated laws than the source materially contains
- extracted roots carry provenance for source class, extraction stage, source label, and source digest
- extraction traces now carry quantitative coverage: source units, extracted root count, expansion delta, and under-enumeration flag

## Seed Extraction Boundary

- `Quantum Spark + EFUE` is the seed/child side
- it creates finite seed structure from open possibility space
- it is distinct from the root/parent under-enumeration rule
- extracted seeds now preserve origin and rank across `per_x`, `delta`, `claim`, and `efue sentence` collapse sources
- live chat now also carries an exact chat-side seed lane from `UIC/UUIS`, so the raw user intention enters `NOCR` without paraphrase loss
- the active QE engine now treats `Quantum Spark` as a lazy branching tree of possibilities and `EFUE` as a bounded finite collapse over that streamed tree
- the same QE formalization now drives artifact seed extraction and coding branch projection; it is no longer separate ad hoc logic in each place

## NOCR Lifecycle

- `FUNNEL_TAGGED` and `COLLAPSE_RESOLVED` remain the core funnel/collapse records
- `COLLAPSE_CLIPPED` records that no lawful parent/root lock occurred and the path clipped to NULL
- `BRANCH_ARCHIVED` and `TREE_ARCHIVED` record non-admissible branches/trees that were formed but not emitted
- `BRANCH_DELETED` and `TREE_DELETED` exist for invalidated lifecycle teardown
- every NOCR lifecycle record mirrored into the `NOCR planet` becomes an immutable parent-tagged law

## Parent Lock Rule

- post-funnel quantum collapse must lock to a real extracted parent/root or the path clips to NULL
- generic domain fallback is not a lawful parent/root meet
- the active post-funnel lock now uses QE collapse over the tagged root space instead of traditional sequential search
- `lock = admissible branch`
- `no lock = clipped NULL`
- clipped NULL may still route through NSL, but it is already correctly null

## Compatibility Terms That Stay For Now

The following active terms remain in code, artifacts, or file names:

- `UNIVERSE_RUNTIME_LAWS`
- `SUN.*`
- `META.*`
- `ABILITY.CODING.*`
- `base_law_count`
- `base_laws_applied`
- `system_laws_applied`
- `merged_ontology_state`
- `canonical-planet-manifest.json`
- `LML_CANONICAL_PLANET_MANIFEST`
- stamped handoff reports and generated bible/jsonl artifacts

Archived-only legacy names such as `canonical-lawpack.json`, `LML_CANONICAL_LAWPACK`, and `DEMO.FUNDAMENTAL.*` are not active runtime terminology.

## Archive Boundary

- `handoff/` is archived and reference-only
- archived handoff outputs are not part of the active universe
- archived handoff outputs must never be used as boot inputs, runtime dependencies, or executable sources
- current runtime truth comes from active source code and active generated artifacts, not archived handoff snapshots
