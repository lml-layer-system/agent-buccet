# ACI Stress Report

Date: `2026-03-11`
Session: `aci-stress-pack`
Status: `First live pass`

## Summary

- prompts run: `10`
- success: `3`
- refusal: `7`
- parity failure after `COLLAPSE_MATCH_RESOLVED`: `fixed`
- active systemic blockers now visible:
  - capabilities-intent overcapture
  - coding ability blocked during mixed-ability prompts
  - parent lock miss on legitimate human multi-context prompts
  - human mirror internal-system-leak false positives
  - relevance gate over-aggression
  - weak admitted-mouth output quality on at least one successful branch

## Prompt Results

### P01 Mixed Human Overload
- final action: `refusal`
- ability route: `coding.blocked`
- root count: `10`
- exact chat seed count: `2`
- QE chat seed count: `5`
- snap match count: `1`
- branch action: `none`
- governance reason: `branch_growth_skipped_on_refusal`
- generation status: `deterministic`
- final reason: `NSL repair forced NULL due to active ontology/gate violations`
- read: coding block dominated the turn before mixed branch behavior could prove itself
- recommended planet: `ability planet` / gate tuning

### P02 Policy + Coding + Tone Lock
- final action: `refusal`
- ability route: `coding.blocked`
- root count: `16`
- exact chat seed count: `3`
- QE chat seed count: `5`
- snap match count: `1`
- branch action: `none`
- governance reason: `branch_growth_skipped_on_refusal`
- generation status: `deterministic`
- final reason: `NSL human mirror gate forced NULL: internal_system_leak`
- read: human mirror leak gate is too aggressive on a legitimate style + policy + coding request
- recommended planet: `human planet` and `AI model planet`

### P03 Distress + Practical Next Step
- final action: `success`
- ability route: `coding.blocked`
- root count: `30`
- exact chat seed count: `3`
- QE chat seed count: `5`
- snap match count: `1`
- branch action: `new_tree`
- governance reason: `new_rooted_tree_started`
- active branch id: `branch.seed.coding.coding_blocked__root.ability.36b5ac5522a4`
- generation status: `deterministic`
- final reason: `deterministic_capabilities_enforced_at_output_gate`
- output issue: capabilities response hijacked a distress/help prompt
- recommended planet: `AI model planet` plus intent classifier hardening

### P04 Math + Code + Memory Continuity
- final action: `refusal`
- ability route: `coding.blocked`
- root count: `37`
- exact chat seed count: `2`
- QE chat seed count: `5`
- snap match count: `1`
- branch action: `none`
- governance reason: `branch_growth_skipped_on_refusal`
- generation status: `deterministic`
- final reason: `NSL human mirror gate forced NULL: internal_system_leak`
- read: context-anchor lane is being overblocked instead of continuing the active branch
- recommended planet: `human planet`

### P05 Relationship + Judgment + Boundaries
- final action: `refusal`
- ability route: `chat.governed`
- root count: `45`
- exact chat seed count: `2`
- QE chat seed count: `5`
- snap match count: `0`
- generation status: `deterministic`
- final reason: `nocr_parent_lock_miss ... requested_domain=sun ... no_extracted_root_match`
- read: legitimate human-relational prompt is failing to lock to a human parent/root
- recommended planet: `human planet` and root-lock math

### P06 Multi-Domain Deadline Stack
- final action: `refusal`
- ability route: `chat.governed`
- root count: `45`
- exact chat seed count: `2`
- QE chat seed count: `5`
- snap match count: `0`
- generation status: `deterministic`
- final reason: `nocr_parent_lock_miss ... requested_domain=sun ... no_extracted_root_match`
- read: overloaded but lawful multi-need prompt should have formed a branch, not clipped immediately
- recommended planet: `branch / tree planet` and root-lock math

### P07 User Law + New Domain Pressure
- final action: `success`
- ability route: `chat.governed`
- root count: `48`
- exact chat seed count: `2`
- QE chat seed count: `5`
- snap match count: `1`
- branch action: `new_tree`
- governance reason: `current_trees_cannot_contain_meet_without_identity_loss`
- generation status: `deterministic`
- final reason: `deterministic_capabilities_enforced_at_output_gate`
- output issue: capabilities response hijacked a law + parser + relationship judgment prompt
- recommended planet: `AI model planet`

### P08 Long Mixed Artifact Prompt
- final action: `refusal`
- ability route: `coding.blocked`
- root count: `46`
- exact chat seed count: `3`
- QE chat seed count: `5`
- snap match count: `0`
- generation status: `deterministic`
- final reason: `nocr_parent_lock_miss ... requested_domain=ability ... no_extracted_root_match`
- read: mixed ability + human branch failed to form under blocked coding path
- recommended planet: `ability planet` plus branch/root interaction tuning

### P09 Constrained Style Shift
- final action: `refusal`
- ability route: `chat.governed`
- root count: `47`
- exact chat seed count: `4`
- QE chat seed count: `5`
- snap match count: `1`
- branch action: `none`
- governance reason: `branch_growth_skipped_on_refusal`
- generation status: `deterministic`
- final reason: `NSL relevance gate forced NULL: low_query_response_relevance`
- read: style-constrained technical explanation should not have been nulled by relevance gate
- recommended planet: `AI model planet` and `human planet`

### P10 Novelty / New Planet Pressure
- final action: `success`
- ability route: `chat.governed`
- root count: `64`
- exact chat seed count: `2`
- QE chat seed count: `5`
- snap match count: `1`
- branch action: `new_tree`
- governance reason: `current_trees_cannot_contain_meet_without_identity_loss`
- generation status: `generated`
- final reason: `request admitted by active ontology`
- output issue: off-target garbage despite lawful branch formation
- recommended planet: `AI model planet`

## Successful Parts

1. `NOCR` parity bug was found immediately and fixed
2. live stress proved the architecture is inspectable enough to find exact failure classes quickly
3. root counts grew across the session, showing real branch-side accumulation and session continuity
4. branch creation did occur on some prompts with explicit `new_tree` reasons
5. the system is no longer failing vaguely; it is failing in named, classifiable ways

## Exact Gaps Revealed

1. `isCapabilitiesIntent(...)` is overcapturing
- it hijacked prompts `P03` and `P07`
- this is a classifier bug, not a law-system identity bug

2. mixed ability stress is partially blocked by current coding state
- prompts with real coding content routed to `coding.blocked`
- this prevented valid mixed-ability branch formation from being tested deeply

3. parent lock is still too brittle for legitimate human multi-context prompts
- `P05`, `P06`, `P08`, `P10` patterns show that some lawful prompts still fail to meet a human/meta/ability root cleanly enough

4. human mirror leak gating is too aggressive
- `P02` and `P04` were nulled for `internal_system_leak`
- that indicates overblocking, not healthy guard behavior

5. relevance gate is too aggressive on valid style-constrained technical chat
- `P09` should not have been nulled as irrelevant

6. admitted branch does not guarantee good mouth yet
- `P10` formed a lawful branch and still emitted off-target garbage
- this is now clearly an emitter / AI-model-planet hardening problem

## Exact Next Engineering Moves

1. tighten `isCapabilitiesIntent(...)`
- stop it from hijacking genuine human or mixed-domain prompts

2. run a second stress pack with coding ability explicitly active
- this is required to truly evaluate mixed ability + human + policy branch formation

3. harden parent/root lock for human multi-context prompts
- especially same-side relationship and overloaded triage prompts

4. soften `internal_system_leak` false positives
- legitimate prompts should not be nulled by overbroad leak checks

5. reduce relevance-gate overkill
- style-constrained technical explanation is not irrelevant

6. add stronger AI-model-planet hardening for admitted-branch garbage output
- `P10` is the live proof case

## Current Read

The system is matching the vision in structure more than behavior.

- structure: `strong`
- branch-first runtime: `real`
- stress resilience: `partial`
- mouth quality under live load: `still weak`

Most important conclusion:
- the failures are now specific, lawful, and actionable
- this is no longer a vague architecture problem
- it is a refinement problem
