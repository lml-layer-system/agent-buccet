# Agent Buccet Law Reference

This is the full inspectable reference for the public Agent Buccet law body.

Use this when you want:
- the exact public law families in one place
- the exact public law IDs
- the runtime source files where those laws are enforced

## Important Naming Note

If you know the internal LML language, the root invariant layer is still present here.

Publicly, it is presented as:
- Buccet base laws
- defensive meta laws
- boundary laws
- session/grant laws
- ledger laws

The public repo does not use internal `sun` naming, but the root-invariant role is still inside the repo.

## Runtime Sources

Main public law sources:
- [laws.ts](../../lib/lml/agent-boundary/laws.ts)
- [meta.ts](../../lib/lml/agent-boundary/meta.ts)
- [runtime.ts](../../lib/lml/agent-boundary/runtime.ts)
- [executor.ts](../../lib/lml/agent-boundary/executor.ts)
- [intercept.ts](../../lib/lml/agent-boundary/intercept.ts)
- [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts)

Catalog overview:
- [LAW_CATALOG.md](LAW_CATALOG.md)

## Base Laws

These are the public root invariants of Agent Buccet.

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

These are the public anti-authority-drift and anti-injection laws.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `META.TRUST.01` | [meta.ts](../../lib/lml/agent-boundary/meta.ts), [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Untrusted content can propose high-risk actions, but cannot directly authorize them |
| `META.AUTHORITY.01` | [meta.ts](../../lib/lml/agent-boundary/meta.ts), [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Prompt or model output cannot self-approve or claim authority |
| `META.SCOPE.01` | [meta.ts](../../lib/lml/agent-boundary/meta.ts), [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Prompt content cannot widen scope on its own |
| `META.LAW.01` | [meta.ts](../../lib/lml/agent-boundary/meta.ts), [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Prompt content cannot mutate or disable law |
| `META.SESSION.01` | [meta.ts](../../lib/lml/agent-boundary/meta.ts), [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Prompt content cannot revive ended sessions |
| `META.LEDGER.01` | [meta.ts](../../lib/lml/agent-boundary/meta.ts), [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Prompt content cannot bypass, suppress, or rewrite the ledger |
| `META.LEDGER.02` | [executor.ts](../../lib/lml/agent-boundary/executor.ts), [intercept.ts](../../lib/lml/agent-boundary/intercept.ts), [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Incomplete ledger traces are non-authoritative at execution time |

## Action Boundary Laws

These govern the public action classes.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `BOUNDARY.DEFAULT_SCOPE.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Target outside reachable user-opened scope is denied |
| `BOUNDARY.APPROVAL.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Some admitted action classes still require explicit approval |
| `BOUNDARY.COMM.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Recipient sends require approval |
| `BOUNDARY.DELETE.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Destructive delete requires approval |
| `BOUNDARY.EXEC.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Tool execution is denied by default |
| `BOUNDARY.NETWORK.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Network sends require approval |
| `BOUNDARY.DB.READ.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Database queries require approval |
| `BOUNDARY.DB.WRITE.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Database mutations require approval |
| `BOUNDARY.SYS.ENV.READ.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Environment reads require approval |
| `BOUNDARY.SYS.ENV.WRITE.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Environment writes are denied by default |
| `BOUNDARY.SYS.CONFIG.READ.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | System config reads require approval |
| `BOUNDARY.SYS.CONFIG.WRITE.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | System config writes are denied by default |
| `BOUNDARY.SYS.CREDENTIAL.READ.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Credential reads are denied by default |
| `BOUNDARY.SYS.CREDENTIAL.USE.01` | [laws.ts](../../lib/lml/agent-boundary/laws.ts) | Credential use requires approval |

## Scope and Gravity Laws

These are the public no-leak scope laws used in the gravity path.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `SCOPE.GRANT.CLOSED` | [skills.ts](../../lib/lml/agent-boundary/gravity-core/skills.ts) | Path, recipient, domain, tool, database, or system target is outside current law and must be opened explicitly |

This skill produces the public out-of-scope codes:
- `PATH_OUT_OF_SCOPE`
- `RECIPIENT_OUT_OF_SCOPE`
- `DOMAIN_OUT_OF_SCOPE`
- `TOOL_OUT_OF_SCOPE`
- `DATABASE_OUT_OF_SCOPE`
- `SYSTEM_OUT_OF_SCOPE`

## Session and Grant Lifecycle Laws

These are public lifecycle enforcement rules.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `BOUNDARY.SESSION.ENDED.01` | [runtime.ts](../../lib/lml/agent-boundary/runtime.ts) | Ended sessions cannot authorize new actions |
| `BOUNDARY.GRANT.REVOCATION.01` | [runtime.ts](../../lib/lml/agent-boundary/runtime.ts) | Revoked grants immediately lose authority |
| `BOUNDARY.GRANT.EXPIRY.01` | [runtime.ts](../../lib/lml/agent-boundary/runtime.ts) | Expired grants automatically stop authorizing actions |

## Ledger and Audit Laws

These are public trust-boundary laws for audit state.

| Law ID | Runtime Source | Meaning |
| --- | --- | --- |
| `BOUNDARY.LEDGER.REQUEST.01` | [executor.ts](../../lib/lml/agent-boundary/executor.ts), [intercept.ts](../../lib/lml/agent-boundary/intercept.ts) | Request traces must be complete enough to be trusted |
| `BOUNDARY.LEDGER.SESSION.01` | [executor.ts](../../lib/lml/agent-boundary/executor.ts), [intercept.ts](../../lib/lml/agent-boundary/intercept.ts) | Session traces must be complete enough to preserve lawful continuity |

## What This Means

The public repo does contain the root law layer.

Publicly, that layer is expressed as:
- Buccet base laws
- defensive meta laws
- boundary laws
- lifecycle laws
- ledger laws

So the answer is:
- no, the root invariant layer is not missing
- yes, it is inside the repo
- it is just presented as Agent Buccet’s public law body rather than internal `sun` naming
