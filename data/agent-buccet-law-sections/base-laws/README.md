# Agent Buccet Base Law Sections

This directory holds the derived Agent Buccet base-law sections.

Rules for this directory:
- raw source stays in `data/lml-law-foundation/`
- this directory is the cleaned sectioned view for base laws only
- each section maps explicit Agent Buccet base laws to explicit `law-web.json` source records
- no meta laws are mixed into this directory as standalone sections

Current section order:
- `01-root-admissibility.json`
- `02-authority-and-authorization.json`
- `03-scope-and-path-law.json`
- `04-session-continuity.json`
- `05-ledger-and-commit-law.json`

Supporting files:
- `manifest.json`
  - section inventory
  - base-law inventory

Build/update command:

```bash
node scripts/build-agent-buccet-base-law-sections.ts
```

Verification command:

```bash
node scripts/agent-buccet-base-law-sections-contract.ts
```
