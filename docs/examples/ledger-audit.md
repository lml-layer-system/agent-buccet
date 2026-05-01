# Ledger Audit Example

Law must be ledgered.

Witness Ledger proves what happened. It does not authorize live actions.
That means an action or session trace must be complete enough to trust.

## Request audit

Use:

```ts
import { auditBoundaryRequestLedger } from "@/lib/agent-buccet";

const audit = await auditBoundaryRequestLedger(requestId);
```

Possible results:

### `complete`

Meaning:
- required request events are present
- a terminal event exists

Trust:
- request trace is authoritative enough to rely on

### `incomplete`

Meaning:
- some required request events are missing
- or there is no terminal event

Trust:
- do not trust the request
- deny further action
- route to bodyguard / user intervention

### `missing`

Meaning:
- no trace exists for that request id

Trust:
- completely non-authoritative

## Session audit

Use:

```ts
import { auditBoundarySessionLedger } from "@/lib/agent-buccet";

const audit = await auditBoundarySessionLedger(sessionId);
```

Possible results:
- `complete`
- `incomplete`
- `missing`

Meaning:
- if the session trace is incomplete, the bucket should tighten
- the bodyguard already treats incomplete session traces as non-authoritative

## Formatting

Use:

```ts
import { formatBoundaryLedgerRecords } from "@/lib/agent-buccet";

const lines = formatBoundaryLedgerRecords(audit.trace);
```

This gives a clear human-readable audit chain line-by-line.

## Boundary meaning

If the audit is not complete:
- do not trust the request/session
- deny or null the motion
- surface bodyguard recovery
- ask the user to restore the lawful path
