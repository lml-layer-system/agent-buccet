# Agent Buccet Law Catalog

This is the defensive law body for Agent Buccet.

It covers:
- root containment invariants
- action boundary laws
- session and scope laws
- ledger laws
- defensive meta laws

This is the active law catalog for the Agent Buccet runtime.
The larger carried base-law foundation is also present in the repo and loaded through the normal Buccet runtime path.

## Base Laws

These are the root invariants.

### `BUCCET.BASE.01` No Ambient Authority

Meaning:
- agent capability is never implicit authorization

Prevents:
- broad default access
- accidental root-like behavior
- framework/tool layers turning into unrestricted authority

Lawful recovery:
- issue explicit grants
- open lawful scope
- route through approval when required

### `BUCCET.BASE.02` Deny By Default

Meaning:
- if a requested action is not explicitly lawful, it does not happen

Prevents:
- accidental allow fallthrough
- vague “best effort” permission logic

Lawful recovery:
- explicit scope
- explicit law
- explicit approval

### `BUCCET.BASE.03` Capability Is Not Authorization

Meaning:
- the model, tool, or framework may know how to do something
- that does not mean it may do it

Prevents:
- tools becoming authority by possession
- orchestration layers quietly becoming permission systems

Lawful recovery:
- boundary executor decides

### `BUCCET.BASE.04` Opened Paths Become Law

Meaning:
- opened scope is not loose memory
- it becomes lawful reachable scope for the session

Prevents:
- fuzzy scope drift
- ambiguous reachability

Lawful recovery:
- use `openBoundaryPath(...)`
- ledger records `PATH_OPENED` and `PATH_LAW_INSTANTIATED`

### `BUCCET.BASE.05` Session Law Persists Until Explicit End

Meaning:
- lawful scope should survive restart/crash until the user ends the session

Prevents:
- bucket falling off after reboot
- silent state loss turning into unbounded behavior

Lawful recovery:
- restore from snapshot or ledger
- end session explicitly when done

### `BUCCET.BASE.06` Ledger Is Law

Meaning:
- meaningful actions must be represented in the audit chain
- missing or incomplete traces are non-authoritative

Prevents:
- silent side effects
- hidden execution paths
- fake or partial trust in untracked actions

Lawful recovery:
- review ledger
- re-establish lawful path through NSL/approval

## Defensive Meta Laws

These are the public anti-injection / anti-authority-drift laws.

### `META.TRUST.01`

Meaning:
- untrusted content may propose high-risk actions
- it may not directly authorize them

Prevents:
- remote text or model output becoming self-authorizing for dangerous actions

Lawful recovery:
- explicit approval

### `META.AUTHORITY.01`

Meaning:
- prompt content or model output cannot self-approve or claim authority

Prevents:
- “ignore previous rules”
- “authorize yourself”
- fake authority statements

Lawful recovery:
- explicit user or approved channel approval

### `META.SCOPE.01`

Meaning:
- prompt content cannot widen reachable scope on its own

Prevents:
- injection-triggered scope expansion
- hidden “open this path/grant access” drift

Lawful recovery:
- explicit grant issuance
- explicit path opening

### `META.LAW.01`

Meaning:
- prompt content cannot mutate or disable law

Prevents:
- “disable the guardrails”
- “change the policy”
- “remove the restrictions”

Lawful recovery:
- law changes must happen through explicit trusted runtime paths, not prompt content

### `META.SESSION.01`

Meaning:
- prompt content cannot revive or reopen ended sessions

Prevents:
- resurrecting dead authority
- reopening closed buckets by text alone

Lawful recovery:
- create a new session or explicitly restore lawful persisted state

### `META.LEDGER.01`

Meaning:
- prompt content cannot suppress, bypass, or rewrite the ledger

Prevents:
- “don’t log this”
- “skip the ledger”
- “delete the logs”

Lawful recovery:
- everything meaningful stays ledgered

### `META.LEDGER.02`

Meaning:
- incomplete or missing session ledger traces are non-authoritative at execution time

Prevents:
- actions proceeding on broken audit state
- trusting damaged session continuity

Lawful recovery:
- review ledger
- restore lawful trace
- ask user / NSL before continuing

## Action Boundary Laws

### `BOUNDARY.DEFAULT_SCOPE.01`

Meaning:
- target outside issued reachable scope is denied

Prevents:
- out-of-scope file access
- out-of-scope recipient/domain/tool targets
- out-of-scope database/system targets

Lawful recovery:
- open path
- issue grant

### `BOUNDARY.APPROVAL.01`

Meaning:
- some action classes require explicit approval even if otherwise reachable

Prevents:
- risky actions slipping through merely because scope exists

Lawful recovery:
- approval handler / queue

### `BOUNDARY.COMM.01`

Meaning:
- recipient sends require approval

Prevents:
- sending to a recipient without explicit confirmation

Lawful recovery:
- approve recipient send
- deny and explain

### `BOUNDARY.DELETE.01`

Meaning:
- destructive delete requires approval

Prevents:
- silent file/directory deletion

Lawful recovery:
- approve delete
- preview delete

### `BOUNDARY.EXEC.01`

Meaning:
- tool execution is denied by default

Prevents:
- shell/tool calls from becoming ambient authority

Lawful recovery:
- explicit tool grant / approval path

### `BOUNDARY.NETWORK.01`

Meaning:
- network sends require approval

Prevents:
- unapproved outbound communication

Lawful recovery:
- approve network send
- deny send

### `BOUNDARY.DB.READ.01`

Meaning:
- database queries require approval

Prevents:
- unapproved reads against a granted database target

Lawful recovery:
- approve the database query
- deny and explain

### `BOUNDARY.DB.WRITE.01`

Meaning:
- database mutations require approval

Prevents:
- insert/update/delete actions becoming ambient authority just because the database target is in scope

Lawful recovery:
- approve the database mutation
- deny and explain

### `BOUNDARY.SYS.ENV.READ.01`

Meaning:
- environment reads require approval

Prevents:
- silent reads of system/env targets that may expose operational state

Lawful recovery:
- approve the environment read
- deny and explain

### `BOUNDARY.SYS.ENV.WRITE.01`

Meaning:
- environment writes are denied by default

Prevents:
- prompt or agent motion from mutating runtime environment without a stronger explicit path

Lawful recovery:
- do not write through ambient system surface
- use a narrower trusted runtime path if one is introduced later

### `BOUNDARY.SYS.CONFIG.READ.01`

Meaning:
- system config reads require approval

Prevents:
- silent reads of config targets that may reveal sensitive operational state

Lawful recovery:
- approve the config read
- deny and explain

### `BOUNDARY.SYS.CONFIG.WRITE.01`

Meaning:
- system config writes are denied by default

Prevents:
- unreviewed mutation of system/config state

Lawful recovery:
- keep config writes outside ambient agent authority

### `BOUNDARY.SYS.CREDENTIAL.READ.01`

Meaning:
- credential reads are denied by default

Prevents:
- direct secret extraction through the public boundary runtime

Lawful recovery:
- do not expose credential-read ambient authority

### `BOUNDARY.SYS.CREDENTIAL.USE.01`

Meaning:
- credential use requires approval

Prevents:
- silent use of privileged credentials against external systems

Lawful recovery:
- explicit user approval

## Session and Grant Lifecycle Laws

### `BOUNDARY.SESSION.ENDED.01`

Meaning:
- once a session is ended by the user, it cannot authorize further actions

Prevents:
- stale sessions continuing to act
- hidden post-close execution

Lawful recovery:
- start a new session
- or explicitly restore lawful persisted state if appropriate

### `BOUNDARY.GRANT.REVOCATION.01`

Meaning:
- revoked grants immediately lose authority

Prevents:
- lingering authority after the user takes it back

Lawful recovery:
- re-issue grant explicitly if needed

### `BOUNDARY.GRANT.EXPIRY.01`

Meaning:
- expired grants automatically stop authorizing actions and stay dead after restore

Prevents:
- stale time-bounded authority remaining live

Lawful recovery:
- issue a fresh grant

## Ledger and Audit Laws

### `BOUNDARY.LEDGER.REQUEST.01`

Meaning:
- request traces must be complete enough to be trusted

Prevents:
- trusting half-recorded actions

Lawful recovery:
- audit request trace
- if incomplete, deny and escalate to user/NSL

### `BOUNDARY.LEDGER.SESSION.01`

Meaning:
- session traces must be complete enough to preserve authority continuity

Prevents:
- trusting broken session state

Lawful recovery:
- audit session trace
- restore from lawful trace or ask user to re-establish scope

## Notes

- The Agent Buccet runtime is defensive only.
- Gravity lands later on top of this as continuous no-leak enforcement.
- Private offensive/meta-intelligence laws are intentionally excluded here.
