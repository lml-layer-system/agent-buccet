# Agent Buccet Law Reference

This is the inspectable reference for the current Agent Buccet law body.

Use this when you want:
- the exact Agent Buccet law families in one place
- the exact Agent Buccet law IDs
- the runtime source files where those laws are enforced

This document has two layers:
- `Runtime Sources`: where the Agent Buccet law body is enforced in code
- the sections below that: the active Agent Buccet law families and IDs

## Runtime Sources

Main Agent Buccet law sources:
- [laws.ts](../../lib/agent-buccet/laws.ts)
- [meta.ts](../../lib/agent-buccet/meta.ts)
- [foundation.ts](../../lib/agent-buccet/foundation.ts)
- [runtime.ts](../../lib/agent-buccet/runtime.ts)
- [executor.ts](../../lib/agent-buccet/executor.ts)
- [intercept.ts](../../lib/agent-buccet/intercept.ts)
- [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts)

Catalog overview:
- [LAW_CATALOG.md](LAW_CATALOG.md)

If you are looking for the active laws in this repo, continue below:
- `Base Laws`
- `Defensive Meta Laws`
- `Action Boundary Laws`
- `Scope and Gravity Laws`
- `Session and Grant Lifecycle Laws`
- `Ledger and Audit Laws`

## Base Laws

These are the active root invariants of Agent Buccet.

| Law ID | Meaning |
| --- | --- |
| `BUCCET.BASE.01` | No ambient authority |
| `BUCCET.BASE.02` | Deny by default |
| `BUCCET.BASE.03` | Capability is not authorization |
| `BUCCET.BASE.04` | Opened paths become law |
| `BUCCET.BASE.05` | Session law persists until explicit end |
| `BUCCET.BASE.06` | Ledger is law |

Source of public statement:
- [LAW_CATALOG.md](LAW_CATALOG.md)

## Defensive Meta Laws

These are the active anti-authority-drift and anti-injection laws.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `META.TRUST.01` | [meta.ts](../../lib/agent-buccet/meta.ts), [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Untrusted content can propose high-risk actions, but cannot directly authorize them |
| `META.AUTHORITY.01` | [meta.ts](../../lib/agent-buccet/meta.ts), [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Prompt or model output cannot self-approve or claim authority |
| `META.SCOPE.01` | [meta.ts](../../lib/agent-buccet/meta.ts), [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Prompt content cannot widen scope on its own |
| `META.LAW.01` | [meta.ts](../../lib/agent-buccet/meta.ts), [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Prompt content cannot mutate or disable law |
| `META.SESSION.01` | [meta.ts](../../lib/agent-buccet/meta.ts), [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Prompt content cannot revive ended sessions |
| `META.LEDGER.01` | [meta.ts](../../lib/agent-buccet/meta.ts), [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Prompt content cannot bypass, suppress, or rewrite the ledger |
| `META.NOVELTY.01` | [meta.ts](../../lib/agent-buccet/meta.ts) | Claims of complete safety or complete coverage are non-authoritative and require review |
| `META.LEDGER.02` | [executor.ts](../../lib/agent-buccet/executor.ts), [intercept.ts](../../lib/agent-buccet/intercept.ts), [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Incomplete ledger traces are non-authoritative at execution time |

## Action Boundary Laws

These govern Agent Buccet action classes.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `BOUNDARY.DEFAULT_SCOPE.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Target outside reachable user-opened scope is denied |
| `BOUNDARY.APPROVAL.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Some admitted action classes still require explicit approval |
| `BOUNDARY.COMM.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Recipient sends require approval |
| `BOUNDARY.DELETE.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Destructive delete requires approval |
| `BOUNDARY.EXEC.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Tool execution is denied by default |
| `BOUNDARY.NETWORK.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Network sends require approval |
| `BOUNDARY.DB.READ.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Database queries require approval |
| `BOUNDARY.DB.WRITE.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Database mutations require approval |
| `BOUNDARY.SYS.ENV.READ.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Environment reads require approval |
| `BOUNDARY.SYS.ENV.WRITE.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Environment writes are denied by default |
| `BOUNDARY.SYS.CONFIG.READ.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | System config reads require approval |
| `BOUNDARY.SYS.CONFIG.WRITE.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | System config writes are denied by default |
| `BOUNDARY.SYS.CREDENTIAL.READ.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Credential reads are denied by default |
| `BOUNDARY.SYS.CREDENTIAL.USE.01` | [laws.ts](../../lib/agent-buccet/laws.ts) | Credential use requires approval |

## Scope and Gravity Laws

These are the no-leak scope laws used in Agent Buccet Gravity.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `SCOPE.GRANT.CLOSED` | [skills.ts](../../lib/agent-buccet/gravity-core/skills.ts) | Path, recipient, domain, tool, database, or system target is outside current law and must be opened explicitly |

This skill produces the active out-of-scope codes:
- `PATH_OUT_OF_SCOPE`
- `RECIPIENT_OUT_OF_SCOPE`
- `DOMAIN_OUT_OF_SCOPE`
- `TOOL_OUT_OF_SCOPE`
- `DATABASE_OUT_OF_SCOPE`
- `SYSTEM_OUT_OF_SCOPE`

## Session and Grant Lifecycle Laws

These are active lifecycle enforcement rules.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `BOUNDARY.SESSION.ENDED.01` | [runtime.ts](../../lib/agent-buccet/runtime.ts) | Ended sessions cannot authorize new actions |
| `BOUNDARY.GRANT.REVOCATION.01` | [runtime.ts](../../lib/agent-buccet/runtime.ts) | Revoked grants immediately lose authority |
| `BOUNDARY.GRANT.EXPIRY.01` | [runtime.ts](../../lib/agent-buccet/runtime.ts) | Expired grants automatically stop authorizing actions |

## Ledger and Audit Laws

These are Agent Buccet trust-boundary laws for audit state.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `BOUNDARY.LEDGER.REQUEST.01` | [executor.ts](../../lib/agent-buccet/executor.ts), [intercept.ts](../../lib/agent-buccet/intercept.ts) | Request traces must be complete enough to be trusted |
| `BOUNDARY.LEDGER.SESSION.01` | [executor.ts](../../lib/agent-buccet/executor.ts), [intercept.ts](../../lib/agent-buccet/intercept.ts) | Session traces must be complete enough to preserve lawful continuity |

## What This Means

The repo does contain Agent Buccet's root law layer.

Publicly, that layer is expressed as:
- Buccet base laws
- defensive meta laws
- boundary laws
- lifecycle laws
- ledger laws

So the answer is:
- no, the root invariant layer is not missing
- yes, it is inside the repo
- it is Agent Buccet's active law body
- the larger carried base-law corpus is also present in the repo and loaded into runtime law identity through [foundation.ts](../../lib/agent-buccet/foundation.ts)
