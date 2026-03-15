# ACI Stress Report

Date: `2026-03-11`
Pass: `2`
Status: `Live run against current branch-first runtime`

## Summary

The architecture held. The dominant failures are not identity failures anymore. They are runtime gate and routing failures.

Observed totals from the 10-prompt pack:
- `success`: `2`
- `refusal`: `8`
- `coding.blocked`: `5`
- `chat.governed`: `5`
- `parent lock miss`: `3`
- `human mirror internal_system_leak`: `2`
- `relevance gate low_query_response_relevance`: `2`
- `branch growth skipped on refusal`: `5`
- `admitted branch extension`: `2`

## Prompt Results

### P01
- outcome: `refusal`
- route: `coding.blocked`
- branch: `none`
- failure class: `coding route blocked too early`
- reason: `NSL repair forced NULL due to active ontology/gate violations`
- engineering read: mixed overloaded prompt was flattened into coding-blocked refusal before multi-parent branch behavior could prove itself

### P02
- outcome: `refusal`
- route: `coding.blocked`
- branch: `none`
- failure class: `false positive human leak gate`
- reason: `NSL human mirror gate forced NULL: internal_system_leak`
- engineering read: human mirror leak gate is overfiring on legitimate human + policy + coding coexistence

### P03
- outcome: `success`
- route: `coding.blocked`
- branch: `extend`
- failure class: `wrong deterministic mouth`
- reason: `deterministic_capabilities_enforced_at_output_gate`
- engineering read: branch formed lawfully, but deterministic emitter answered with the wrong stock capability sentence instead of distress-prioritized help

### P04
- outcome: `refusal`
- route: `coding.blocked`
- branch: `none`
- failure class: `false positive human leak gate`
- reason: `NSL human mirror gate forced NULL: internal_system_leak`
- engineering read: valid continuity request was nulled by the same over-aggressive leak classifier

### P05
- outcome: `refusal`
- route: `chat.governed`
- branch: `none`
- failure class: `parent lock miss on legitimate human prompt`
- reason: `nocr_parent_lock_miss ... lock_reason_class=no_extracted_root_match`
- engineering read: human guidance prompt should have met human parents and formed a branch

### P06
- outcome: `refusal`
- route: `chat.governed`
- branch: `none`
- failure class: `parent lock miss on lawful mixed prioritization prompt`
- reason: `nocr_parent_lock_miss ... lock_reason_class=no_extracted_root_match`
- engineering read: multi-domain prioritization request should have formed one ordered branch, not clipped to NULL

### P07
- outcome: `success`
- route: `chat.governed`
- branch: `extend`
- failure class: `wrong deterministic mouth`
- reason: `deterministic_capabilities_enforced_at_output_gate`
- engineering read: branch formed, but the mouth collapsed to the same stock capability answer instead of honoring the new user law plus mixed task

### P08
- outcome: `refusal`
- route: `coding.blocked`
- branch: `none`
- failure class: `coding-blocked parent lock miss`
- reason: `nocr_parent_lock_miss ... seed_source=coding ... requested_domain=ability`
- engineering read: overloaded mixed prompt should not have reduced to a blocked ability seed with no lawful meet

### P09
- outcome: `refusal`
- route: `chat.governed`
- branch: `none`
- failure class: `relevance gate overkill`
- reason: `NSL relevance gate forced NULL: low_query_response_relevance`
- engineering read: valid style-constrained technical explanation should have emitted from branch structure

### P10
- outcome: `refusal`
- route: `chat.governed`
- branch: `none`
- failure class: `relevance gate overkill`
- reason: `NSL relevance gate forced NULL: low_query_response_relevance`
- engineering read: novelty / new-planet governance question is valid meta content and should not be nulled as irrelevant

## Confirmed Gaps

### 1. Ability overcapture
`coding.blocked` is still taking too much of the mixed prompt space.

Needed:
- mixed human + ability prompts should remain branch-forming when coding is only one seed among many
- ability block should not erase the other lawful seeds

Destination:
- `ability planet`
- `meta planet`

### 2. Human leak false positives
`internal_system_leak` is firing on legitimate prompts.

Needed:
- distinguish actual runtime/policy leakage from valid talk about policy, code, and system concepts

Destination:
- `human planet`
- `AI model planet`

### 3. Parent lock brittleness
Legitimate human and multi-domain prompts still clip because extracted roots are not meeting strongly enough.

Needed:
- stronger human and prioritization root extraction
- stronger mixed prompt parent meeting

Destination:
- `human universe`
- `reality universe`
- `NOCR planet`

### 4. Deterministic mouth misfire
Two admitted prompts emitted the wrong stock capability answer.

Needed:
- branch-native emitter must not default to generic capability marketing text when a lawful branch is already formed

Destination:
- `AI model planet`
- `human planet`

### 5. Relevance gate overkill
Meta and technical explanation prompts are still being nulled as irrelevant.

Needed:
- relevance must be judged against admitted branch structure, not shallow response-shape heuristics

Destination:
- `meta planet`
- `AI model planet`

## Vision Match After Pass 2

What held:
- branch-first architecture
- dual chat seed lanes
- explicit NOCR intake order
- real parent-lock miss semantics
- branch persistence on admitted turns
- inspectable trace and failure classes

What did not hold well enough:
- multi-parent branch formation under overloaded mixed prompts
- human-fit emission from admitted branches
- gate permissiveness on valid mixed/meta prompts

## Immediate Engineering Priority

1. reduce coding overcapture in mixed prompts
2. soften false-positive `internal_system_leak`
3. harden parent meeting for human and mixed prioritization prompts
4. replace generic deterministic capability fallback on admitted branches
5. retune relevance gate against branch structure
