# Agent Buccet Base Laws Work Protocol

This repo exists to remodel the full Agent Buccet base-law corpus into clean Agent Buccet form without drift.

This is not the runtime repo.
This is the isolated base-law workspace.
This repo must stay ready for upstream runtime transfer.

## Mission

Carry the entire base-law body forward.
Do not leave base laws out.
Do not collapse the corpus into summaries.
Do not trim first and ask questions later.

Default stance:
- preserve
- remodel
- review
- trim only after explicit review

## What This Repo Contains

- `README.md`
  - corpus overview
- `data/working/base-law-families/manifest.json`
  - current surviving Agent Buccet base-law family manifest
- `data/working/base-law-runtime-corpus/manifest.json`
  - current active base-law manifest
  - active base laws: 7,221
- `data/working/base-law-runtime-corpus/projected-laws.json`
  - flattened runtime-ready Agent Buccet base-law corpus
- `data/working/time-law-runtime-corpus/projected-laws.json`
  - flattened runtime-ready Agent Buccet time-law corpus
- `data/working/active-law-body/projected-laws.json`
  - combined active Agent Buccet law body for transfer
- `data/working/runtime-law-substrate/agent-buccet-runtime-substrate.json`
  - compressed runtime substrate for the full active Agent Buccet law body
- `data/working/runtime-law-substrate/manifest.json`
  - runtime substrate manifest and exactness hashes
- `data/working/user-path-ledger-spec.json`
  - canonical User Path Ledger governing-law list
- `UPSTREAM_TRANSFER_CONTRACT.json`
  - machine-readable transfer and wiring contract for the later upstream attach
- `scripts/verify-upstream-transfer.js`
  - runnable verification for runtime-ready base-law transfer readiness

The raw 68,277-law source payload was removed from this repo after remodeling.
Historical reports may still reference the raw source count for provenance, but the active source of truth is now the remodeled family corpus and runtime projection.

Additional imported continuity payload:
- `data/meta-law-foundation/ancestor/LAWS_META.docx`
- `data/meta-law-foundation/ancestor/LAWS_META.txt`
- `data/meta-law-foundation/ancestor/manifest.json`
- `data/working/time-law-family/manifest.json`
- `data/working/time-law-runtime-corpus/manifest.json`

Treat that entire imported document as the ancestor meta-law body.
Do not narrow it based on internal labels inside the document.
That payload has now been remodeled into Agent Buccet time laws.

Current time-law truth:
- one active time-law family
- `988` active time laws
- the time-law family is part of the active Agent Buccet defensive surface
- `MT-00401` through `MT-00420` are authored Agent Buccet time laws added to close identified gaps in user-path memory and continuity enforcement coverage

Current active law truth:
- active base laws: `7,221`
- active time laws: `988`
- full active Agent Buccet law body: `8,209`

Runtime form truth:
- the base runtime corpus is family-compressed active law
- individual source law ids remain as trace and indexing anchors
- the time runtime corpus carries per-law continuity anchors across `BASE`, `STATE`, `OUTPUT`, and `TEMPORAL`
- the combined active-law-body artifact is the transfer-ready merged law surface
- the runtime-law-substrate artifact is the snapped always-on runtime form of that same merged law surface
- the User Path Ledger governing laws are canonically listed in `data/working/user-path-ledger-spec.json`
- the User Path Ledger behavioral contract lives in `user-path-ledger-spec.json`
- this repo verifies transfer-surface integrity only; live upstream runtime existence and loader ingestion must be verified in the `agent-buccet` runtime repo

Reports truth:
- `reports/` contains historical pass logs and audits
- it is useful for provenance, not as the authoritative transfer surface

## Hard Rules

1. Law body only.
This repo carries Agent Buccet base laws and time laws.
Do not introduce unrelated runtime-law families or off-mission law work into this repo.

2. No drift.
Do not invent laws.
Do not paraphrase away load-bearing meaning.
Do not silently merge distinct laws.
Do not silently delete laws.

3. Agent Buccet identity only.
The target identity is Agent Buccet.
Remodel wording toward Agent Buccet naming.
Do not introduce new ancestor-system framing into public-facing transformed outputs.

4. Preserve before trimming.
The first job is faithful carryover into Agent Buccet form.
Trimming is a later explicit review step.
If uncertain, keep it and flag it.

5. Section-by-section only.
Do not try to remodel the entire corpus in one pass.
Work in explicit sections.
Finish one section cleanly before moving to the next.

6. Source trace must survive.
Every transformed section must retain a clear mapping back to source records.
Do not create orphan transformed text with no source anchor.

7. No sidecar abstraction detours.
Do not build extra frameworks, generators, staging systems, or derived products unless explicitly requested.
The work is direct corpus transformation.

8. Review before policy deletion.
If a law looks redundant, strange, broad, or trim-worthy, do not remove it immediately.
Mark it for review.

## Required Workflow

For each section:

1. Define the section boundary.
2. Extract only that section's source records.
3. Remodel that section into Agent Buccet wording.
4. Preserve source IDs or an exact trace map.
5. Run a consistency review on that section.
6. Present trim candidates separately from the transformed section.
7. Only trim after explicit approval.

## Upstream Runtime Transfer Contract

This repo is preparing a runtime-ready base-law body for later transfer into Agent Buccet.

That transfer is not a redesign.
It is a controlled foundation replacement.

When the remodeled base-law body is transferred upstream:

1. The target runtime repo is `agent-buccet`.
2. The target data directory is `data/agent-buccet-law-foundation/`.
3. The active loader seam is `lib/agent-buccet/foundation.ts`.
4. Active law continuity must remain preserved through:
   - `lib/agent-buccet/state.ts`
   - `lib/agent-buccet/policy.ts`
5. Interceptor, Gravity, NSL, and ledger flow stay structurally unchanged.
6. The job upstream is to swap in the remodeled Agent Buccet base-law payload cleanly.

The executable source of truth for this transfer contract is:
- `UPSTREAM_TRANSFER_CONTRACT.json`
- `scripts/verify-upstream-transfer.js`

## Agent Buccet NSL Policy

Agent Buccet is not LML.
LML is the ancestor system that had no interceptor.
Because LML had no interceptor, far more law and repair behavior had to act like interception directly.

Agent Buccet is different:
- Agent Buccet Interceptor catches anything attempting to cross the action-boundary layer
- Agent Buccet Gravity contains and routes the motion
- the user is asked `yes` or `no`
- if `yes`, that exact path can become law
- if `no`, Agent Buccet asks a second time whether to make that denial a law

Because of that structure, Agent Buccet uses a smaller, finite repair surface than ancestor-era LML.
That finite NSL layer is all Agent Buccet needs here.
It does not merely eliminate classes of failure.
It can eliminate whole worlds of failure by turning repeated `yes` and `no` decisions into law at the action-boundary layer.

For Agent Buccet remodeling work:
- do not blindly carry older NSL repair complexity over as if Buccet still lacked interception
- interpret NSL-style entries in Buccet as finite corrective routing and decision paths
- keep the repair logic that still matters for Buccet
- do not overstate repair breadth that Interceptor and Gravity already cover
- preserve source trace while translating ancestor repair surfaces into Agent Buccet boundary-repair language

Practical rule:
- in LML, repair often had to be the interception layer
- in Agent Buccet, interception already exists, so repair is narrower and user-mediated

When converting ancestor repair identities into Agent Buccet wording:
- preserve the function
- reduce the framing to Agent Buccet's actual role
- remember that Buccet catches the action-boundary attempt before it lands

## What Counts As Success For A Section

A section is successful when:
- it is fully Agent Buccet in wording
- it preserves the source meaning
- it does not drop laws silently
- it does not invent new laws
- it can be traced back to exact source records
- trim candidates, if any, are called out separately

## What Not To Do

Do not:
- one-shot the whole 68k corpus
- convert without source mapping
- trim during first-pass remodeling
- mix base-law work with runtime redesign
- add speculative policy not present in source
- collapse multiple laws into a single convenience summary

## Chunking Guidance

Preferred working size:
- about `500` to `2,000` laws at a time

Preferred target:
- around `1,000` laws per section pass

If a section is semantically dense, make it smaller.
Accuracy is more important than speed.

## Roles

Expected collaboration model:
- Codex: exact file work, segmentation, controlled edits
- Claude Code: secondary reasoning/review pass
- Cursor: fast inspection, search, diff, local review surface
- Human: final authority on meaning, trim, and coherence

If tools disagree:
- preserve source
- surface the disagreement
- do not force a merge without review

## Final Principle

The law body is the thing.
The job is to carry it forward cleanly into Agent Buccet form.
If coherence is threatened, stop and tighten the section boundary.
