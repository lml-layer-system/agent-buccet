# Full Implementation Plan

Date: `2026-03-10`
Status: `Active exact engineering move`
Scope: `LML universe only`
Directive: `Do not drift from this list`

## Destination

Target system:
- `ACI` = `Artificial Constraint Intelligence`
- intelligence formed through lawful structure, not raw unconstrained generation
- one active admitted chat branch that grows until the chat is done
- roots/parents govern law and domain structure
- seeds/children govern incoming intent, possibility, and expression
- `NOCR` tags and funnels
- post-`NOCR` snap creates lawful branch structure
- ledgers mirror into planets as immutable parent-root law bodies
- failures become laws in the correct planet

## Final Pipeline

1. input enters
2. law-side extraction creates `roots/parents`
3. chat-side exact extraction creates exact `seeds/children`
4. chat-side `LML convo mirror` QE creates `N` conversational possibilities
5. `EFUE` collapses those to finite conversational seeds
6. `NOCR` receives:
- roots first
- exact chat seeds second
- QE/EFUE conversational seeds third
7. post-`NOCR` snap occurs
8. admitted multi-seed/multi-parent meet forms a `branch`
9. branch is persisted into `branch/tree planet`
10. output renders from admitted branch state
11. failures become laws in the right planet

## Completed

### 1. Branch-First Chat Runtime

Implemented:
- active chat branch state
- branch extend/fork/close logic
- branch state persisted in context
- branch state surfaced in trace and `/api/lml-state`

Files:
- [active-chat-branch.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/active-chat-branch.ts)
- [infinite-context.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/infinite-context.ts)
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)

### 2. Full Chat-Side Dual Seed Intake

Implemented:
- exact `UIC/UUIS` chat seed lane
- `LML convo mirror` QE lane
- `EFUE` collapse to finite conversational seeds
- both seed families visible in trace

Files:
- [chat-convo-qe.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-convo-qe.ts)
- [chat-efue-collapse.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-efue-collapse.ts)
- [seed-extraction.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/seed-extraction.ts)

### 3. NOCR Intake Order Made Literal

Implemented:
- roots enter first
- exact chat seeds enter second
- QE chat seeds enter third
- explicit trace fields exist

Trace fields:
- `nocr_input.root_count`
- `nocr_input.chat_exact_seed_count`
- `nocr_input.chat_qe_seed_count`

Files:
- [engine.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/engine.ts)
- [types.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/types.ts)
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)

### 4. Post-NOCR Snap As Branch Constructor

Implemented:
- post-`NOCR` snap is multi-seed aware
- one turn can carry multiple lawful seed/parent meets
- `snapMatches[]` are visible in trace and state
- branch creation now uses admitted snap structure, not a single flattened intent

Files:
- [quantum-collapse.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/quantum-collapse.ts)
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)
- [route.ts](/Users/ryangatoloai-faupula/lml_demo/app/api/lml-state/route.ts)
- [page.tsx](/Users/ryangatoloai-faupula/lml_demo/app/page.tsx)

### 5. Branch / Tree Planet As Chat Backend

Implemented:
- `branch/tree planet`
- lifecycle events:
- `BRANCH_EXTENDED`
- `TREE_EXTENDED`
- `BRANCH_FORKED`
- `BRANCH_CLOSED`
- branch/tree lifecycle visible in state and UI
- branch/tree source inventory includes static laws plus mirrored runtime laws

Files:
- [branch-tree-planet.ts](/Users/ryangatoloai-faupula/lml_demo/lib/nocr/branch-tree-planet.ts)
- [branch-tree-planet-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/branch-tree-planet-laws.ts)

### 6. Renderer Reads From Branch

Implemented:
- branch renderer contract exists
- major mouth lanes render from admitted branch structure instead of a looser prompt blob
- human mirror compiler is unified across major mouth lanes

Files:
- [branch-renderer.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/branch-renderer.ts)
- [human-mirror.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/human-mirror.ts)
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)

### 7. AI Model Planet Enforcement

Implemented:
- `AI model planet`
- `ai_model_planet_hardening`
- generation and mouth failures land in the correct planet
- critical renderer hardening auto-applies through meta delivery

Files:
- [ai-model-planet-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/ai-model-planet-laws.ts)
- [meta-delivery.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/meta-delivery.ts)
- [chat-runtime.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/chat-runtime.ts)

### 8. Human Planet As Conversational Compiler

Implemented:
- `human mirror compiler`
- human-output admissibility classifier
- `meta_human_generation_hardening` folded into the AI model hardening path
- specialized mouth routes now share the same human mirror layer

Files:
- [human-mirror.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/human-mirror.ts)
- [human-planet-runtime-laws.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/human-planet-runtime-laws.ts)
- [human-planet-runtime-laws-phase-2.ts](/Users/ryangatoloai-faupula/lml_demo/lib/lml/human-planet-runtime-laws-phase-2.ts)

### 9. Governance Planets And Ledgers

Implemented:
- `NOCR ledger` + `NOCR planet`
- `NSL ledger` + `NSL repair planet`
- `meta delivery ledger` + `meta delivery planet`
- parity checks
- fail-closed behavior on critical parity and coverage paths

## Exact Remaining Gaps

### 1. Per-Match Collapse Atomization

Current state:
- `snapMatches[]` are embedded inside the resolved collapse record

Gap:
- each lawful seed/parent meet is not yet its own first-class ledger event family

Required move:
- add `COLLAPSE_MATCH_RESOLVED`
- optional later: `COLLAPSE_MATCH_CLIPPED`

Acceptance:
- each snap match can be replayed, inspected, counted, and mirrored independently

### 2. Branch Governance Completion

Current state:
- extend/fork/close/tree-extend exists
- governance uses explicit branch/tree laws

Gap:
- merge/split/sibling/new-tree cases are not yet mathematically complete
- dominance rules between concurrent branch candidates are still thin

Required move:
- formalize:
- extend
- fork
- sibling
- new tree
- merge
- close
- dominance

Acceptance:
- branch decisions are deterministic and fully explainable in multi-context chat

### 3. Deterministic Branch Emitter

Current state:
- renderer now consumes a compact branch contract

Gap:
- final mouth is still a renderer after the structure, not yet a more deterministic branch-native emitter

Required move:
- reduce renderer freedom further
- promote more branch-native response assembly
- keep generation only where needed

Acceptance:
- output is primarily assembled from admitted branch structure, with less freeform drift

### 4. Hard Artifact Pressure Testing

Current state:
- architecture supports mixed artifacts

Gap:
- not yet pressure-tested on ugly real-world inputs at depth

Required move:
- test with:
- code + math + emotional chat in one turn
- policy + user law + coding request in one turn
- long papers and mixed docs
- contradictory domain pulls inside one branch

Acceptance:
- branch formation and root/seed routing stay lawful under mixed stress

### 5. Storage And Replay Hardening

Current state:
- JSONL ledgers and mirrored planet files are working

Gap:
- query and replay depth are still early for long-running scale

Required move:
- indexed ledger store
- replay by branch/tree/snap-match/run/session

Acceptance:
- long-running branches remain fast and inspectable

## Next Exact Engineering Moves

### Move 1: Atomize Snap Matches

Build:
1. add `COLLAPSE_MATCH_RESOLVED`
2. add one record per admitted seed/parent meet
3. mirror these into the `branch/tree planet`
4. expose them in state/UI

Priority: `highest`

### Move 2: Complete Branch Governance

Build:
1. add explicit sibling/new-tree decision paths
2. add merge rules
3. add branch dominance rules
4. emit `governanceReason` for every branch decision path

Priority: `highest`

### Move 3: Tighten Branch Emitter

Build:
1. branch-native output contract per lane
2. deterministic slot assembly where possible
3. let the model fill only narrow lawful gaps
4. route drift into `AI model planet` hardening

Priority: `highest`

### Move 4: Run Hard Mixed-Artifact Tests

Build:
1. test fixtures for mixed multi-domain prompts
2. inspect branch formation, snap matches, clip behavior, and mouth quality
3. convert failures into laws in the right planet

Priority: `high`

### Move 5: Harden Storage And Replay

Build:
1. indexed ledger store
2. branch/tree/snap-match replay helpers
3. long-running worker-safe query path

Priority: `high`

## Non-Negotiables

1. one admitted chat line belongs to a branch
2. `NOCR` tags active chat and makes it stable
3. complex chat turns can produce one branch with many seeds and many parents
4. branch/tree planet is the backend home of chat structure
5. lock or clip, never fake fallback
6. new failures become laws in the correct planet
7. `AI model planet` stays model-agnostic
8. `meta` remains catch-all governance with novelty caution
9. only stable missing-domain root bodies justify new planets

## Current Read

How far from destination:
- architecture: `70-80%`
- fully embodied product behavior: `45-55%`

What is matched already:
- system identity
- branch-first chat
- dual seed intake
- post-`NOCR` snap structure
- planet organization
- self-hardening
- renderer governance

What is not fully matched yet:
- per-match ledger granularity
- complete branch math
- deterministic branch-native mouth
- hard universality proof under stress

## Bottom Line

The system is no longer drifting from the vision.

The remaining work is now finite and concrete:
1. atomize snap matches
2. complete branch governance
3. tighten the branch emitter
4. pressure-test mixed artifacts
5. harden storage and replay
