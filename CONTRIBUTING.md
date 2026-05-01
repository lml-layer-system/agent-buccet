# Contributing to Agent Buccet

Thank you for your interest in contributing. Agent Buccet is a containment and enforcement layer for AI agents — contributions that strengthen the boundary, improve the law engine, or extend the integration surface are welcome.

## Core Principle

Before contributing, internalize this: **Agents can propose. They cannot authorize.** Every contribution should be evaluated against whether it maintains or strengthens this invariant. Code that relaxes boundary enforcement without explicit user action is a regression.

## Development Setup

**Requirements:** Node.js ≥22, npm ≥10

```bash
git clone https://github.com/lml-layer-system/agent-buccet
cd agent-buccet
npm install
npm run typecheck
```

## Running the Contracts

Agent Buccet uses executable contract tests rather than a unit test framework. Core contracts must pass before any PR is merged.

**Blocking contracts (must all pass):**
```bash
npm run test:agent-buccet:foundation
npm run test:agent-buccet:time-runtime
npm run test:agent-buccet:gravity-contract
npm run test:agent-buccet:ledger-contract
npm run test:agent-buccet:wrapper-contract
```

**Full stable suite:**
```bash
npm run check:agent-buccet:contracts-stable
```

**Run the end-to-end demo:**
```bash
npm run demo:agent-buccet
```

## How Laws Work

Laws are typed policy evaluators. Each `BoundaryLaw` has:
- A `lawId` string (e.g. `"BOUNDARY.DELETE.01"`)
- An `appliesTo` list of `BoundaryActionKind` values (or `["*"]` for all)
- An `evaluate()` function that returns `BoundaryLawResult | null`

`null` means the law has no opinion. A non-null result wins.

Laws live in `src/law/laws.ts` and `src/runtime/time.ts`. The full law reference is at [`docs/specs/LAW_REFERENCE.md`](docs/specs/LAW_REFERENCE.md).

**To add a new law:**
```typescript
// In src/law/laws.ts, add to DEFAULT_BOUNDARY_LAWS:
{
  lawId: "BOUNDARY.MYLAW.01",
  description: "What this law enforces.",
  appliesTo: ["fs.write"],
  evaluate: ({ session, request, activeGrants }) => {
    if (/* condition does not apply */) return null;
    return {
      decision: "deny",
      reason: "clear explanation of why this was blocked",
      triggeredLawIds: ["BOUNDARY.MYLAW.01"],
      requiresApproval: false,
    };
  },
},
```

Laws must be deterministic. They must not have side effects. They must return `null` when they have no opinion (not `allow` — `allow` overrides other laws).

## Architecture Overview

The action boundary path:

```
agent proposes action
  → Interceptor catches (intercept.ts)
  → Gravity holds (gravity.ts)
  → Bodyguard checks UPL (bodyguard.ts / bodyguard-core.ts)
    → standing allow → let through
    → standing deny → block
    → no standing law → evaluate laws (runtime.ts / bodyguard-core.ts)
      → allow / deny / require_approval
      → if require_approval: ask user
        → user yes → becomes standing UPL allow
        → user no → one-time deny (optionally becomes standing UPL deny)
  → Witness Ledger records everything (ledger.ts)
```

Key files:
| File | Purpose |
|------|---------|
| `src/runtime/types.ts` | All core types |
| `src/law/laws.ts` | Default boundary laws |
| `src/runtime/time.ts` | Time-body defensive laws |
| `src/runtime/runtime.ts` | Grant/path lifecycle, law evaluation |
| `src/boundaries/bodyguard.ts` | Primary integration surface |
| `src/proof/ledger.ts` | Append-only witness ledger |
| `src/proof/user-path-ledger.ts` | Standing user law (UPL) |
| `src/engines/gravity/gravity-core/` | Gravity kernel + law skills |

## Branch Model

- `main` — protected, never pushed to directly
- `buccet-base-time-law-transfer` — active development branch
- Feature/fix branches: `buccet-<feature>` or `claude/<task>-<id>`

Open PRs against `buccet-base-time-law-transfer`, not `main`.

## What to Contribute

**Welcome:**
- Bug fixes in law evaluation logic
- New integration adapters (new framework in `src/integrations/`)
- Additional contract tests for edge cases
- Documentation improvements (law catalog, quickstart, examples)
- Performance improvements to the ledger hot path

**Requires discussion first:**
- New law families (open an issue first — law additions affect the entire active boundary)
- Changes to the grant or session lifecycle
- Modifications to ledger record format (breaks existing audit chains)
- Changes to UPL (User Path Ledger) schema

**Not accepted:**
- Code that allows agents to authorize their own actions
- Code that widens scope without explicit user grant
- Code that reads the Witness Ledger for authorization decisions
- Backdoors, ambient permissions, or "convenience" bypasses

## Code Style

The codebase uses TypeScript strict mode. No `any` types without justification. Keep files focused — if a module is growing, look for a natural seam to split it.

## License

By contributing to Agent Buccet, you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
