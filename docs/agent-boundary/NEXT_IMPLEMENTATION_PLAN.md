# Agent Buccet Next Implementation Plan

## Objective

Close the remaining repo gaps after the core boundary runtime hardening pass.

This plan does **not** cover the demo itself.
It covers the missing pieces around:
- visibility
- trust
- adoption
- packaging
- integration clarity
- gravity-ready landing prep

## Current State

Already in place:
- law engine
- scope/path orchestration
- persistent session state
- grant issue / revoke / expiry
- crash-safe restore
- ledger as law
- defensive meta laws
- filesystem containment
- recipient/domain/tool containment
- remote proposal hardening
- shared executor
- framework integration entrypoints
- shared runtime/bodyguard layer

## Remaining Gaps

### 1. Root-Level Surfacing

Problem:
- the boundary slice is strong internally, but the top of the repo does not yet clearly surface Agent Buccet as a first-class public slice

Deliverables:
- add a root README section for Agent Buccet
- add a direct pointer to `docs/agent-boundary/README.md`
- add a direct pointer to the quickstart and integrations docs

Success condition:
- a new reader can land at repo root and immediately understand that Agent Buccet exists and where to enter it

## 2. Public Law Catalog

Problem:
- the public defensive laws exist in code and doctrine docs, but the repo still lacks one complete enumerated law catalog

Deliverables:
- `docs/agent-boundary/LAW_CATALOG.md`

Scope:
- `sun` invariants
- boundary laws
- scope laws
- session laws
- approval laws
- ledger laws
- defensive meta laws

For each law include:
- law id
- title
- plain-language meaning
- what it prevents
- what the lawful recovery path is

Success condition:
- a reader can audit the public law body without reading code

## 3. Integration Usage Snippets

Problem:
- integration modules exist, but there are no minimal snippets showing how to actually attach Buccet to a host stack

Deliverables:
- `docs/agent-boundary/examples/nemo.md`
- `docs/agent-boundary/examples/openai-agents.md`
- `docs/agent-boundary/examples/langgraph.md`
- `docs/agent-boundary/examples/telegram.md`

Each snippet should show:
- create or restore shared runtime store
- create bodyguard
- wrap one proposed action
- approval/deny path

Success condition:
- a developer can see the exact attach point in under 2 minutes

## 4. Policy Examples

Problem:
- policy loading exists, but no sample policy packs are present

Deliverables:
- `docs/agent-boundary/examples/policies/filesystem-only.json`
- `docs/agent-boundary/examples/policies/remote-recipient.json`
- `docs/agent-boundary/examples/policies/tool-lockdown.json`

Each policy should show:
- approval-required actions
- initial grants
- requested public law ids

Success condition:
- a user can copy one sample policy and start from it instead of inventing structure

## 5. Approval Flow Examples

Problem:
- the approval queue adapter exists, but the repo does not yet show the human loop clearly

Deliverables:
- `docs/agent-boundary/examples/approval-flow.md`

Show:
- pending approval record
- approve
- deny
- resulting ledger entries
- how Telegram/remote control should surface this

Success condition:
- approval no longer looks abstract; it looks like a real operational path

## 6. Ledger / Audit Examples

Problem:
- ledger helpers and audit helpers exist, but there is no public example showing what “complete”, “incomplete”, and “missing” traces look like

Deliverables:
- `docs/agent-boundary/examples/ledger-audit.md`

Show:
- complete request trace
- incomplete request trace
- missing trace
- session trace example
- resulting boundary meaning:
  - trust
  - deny
  - NSL escalation

Success condition:
- users immediately understand why ledger is law instead of “just logging”

## 7. Repo Packaging Boundary

Problem:
- Agent Buccet still lives inside the broader `lml_demo` repo layout
- the public slice is coherent, but not yet extracted cleanly as an independent package/repo boundary

Deliverables:
- packaging assessment doc:
  - `docs/agent-boundary/PACKAGING_PLAN.md`

Decide:
- what files would ship in a standalone public repo
- what stays behind in the broader universe
- what needs path/import cleanup for extraction
- what data/docs/examples should move with it

Success condition:
- we know exactly how to split the public slice cleanly when ready

## 8. Naming Consistency Pass

Problem:
- key docs use `Agent Buccet`, but not every relevant public-facing surface has been normalized yet

Deliverables:
- rename pass checklist

Targets:
- doc titles
- section names
- report language
- integration docs
- quickstart references
- root surfacing references

Success condition:
- the public repo reads as one coherent named system

## 9. Gravity Landing Plan

Problem:
- gravity is understood conceptually, but there is not yet a precise landing plan tying it into the current boundary runtime

Deliverables:
- `docs/agent-boundary/GRAVITY_LANDING_PLAN.md`

Must define:
- what gravity attaches to
- what gravity must not replace
- where `GravityState` maps onto current boundary/session/ledger state
- where event production comes from
- where no-leak null-collapse happens
- what stays public defensive vs private stronger runtime

Success condition:
- gravity can land last without destabilizing the finished boundary slice

## Recommended Build Order

1. root-level surfacing
2. law catalog
3. policy examples
4. integration usage snippets
5. approval flow examples
6. ledger/audit examples
7. naming consistency pass
8. packaging plan
9. gravity landing plan
10. demo

## Why This Order

- root surfacing makes the slice visible
- law catalog makes it trustworthy
- policy/examples make it usable
- packaging plan makes it exportable
- gravity plan keeps the final addition disciplined
- demo should happen after the repo is coherent enough to support it cleanly

## Completion Criteria

This next phase is complete when:
- the repo root clearly points to Agent Buccet
- the public law body is fully enumerated
- sample policy packs exist
- each supported integration has a minimal attach example
- approval flow is documented concretely
- ledger/audit examples make trace completeness obvious
- packaging boundary is explicit
- gravity landing plan is written

At that point, the repo will be:
- technically strong
- publicly legible
- integration-friendly
- gravity-ready
