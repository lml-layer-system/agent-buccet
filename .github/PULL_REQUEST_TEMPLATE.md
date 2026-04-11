## What does this change?

<!-- Describe the change in 1-3 sentences. -->

## Why?

<!-- What problem, attack vector, or gap does this address? -->

## Law IDs affected

<!-- List any law IDs added, changed, or removed. Use "none" if not applicable. -->

- [ ] None
- [ ] Added: <!-- e.g. TIME.CREDENTIAL.01 -->
- [ ] Modified: <!-- e.g. TIME.TRUST.01 -->
- [ ] Removed: <!-- e.g. BOUNDARY.META.01 (renamed) -->

## Testing

<!-- Which contracts cover this change? Run them and paste output. -->

```
npm run test:agent-buccet:law-unit
npm run demo:agent-buccet:attacks
```

<details>
<summary>Contract output</summary>

```
paste output here
```

</details>

## Checklist

- [ ] `npm run typecheck` passes
- [ ] Relevant contract tests pass
- [ ] Does not add ambient permissions or bypass the enforcement chain
- [ ] Does not weaken existing law evaluations
- [ ] Ledger entries are preserved (no deletions or rewrites)
