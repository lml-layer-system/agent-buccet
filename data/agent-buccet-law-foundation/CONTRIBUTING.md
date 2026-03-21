# Contributing to Agent Buccet Base Laws

Welcome. This repo carries the defensive law body for Agent Buccet. Contributions are welcome
and held to a high standard — these laws govern real AI agent behavior.

---

## What Is In Scope

- **Coverage audits** — identifying gaps in family coverage, laws that were miscategorized,
  or source laws that survived remodeling but don't belong in a given family
- **Time law reconstruction** — improvements to the ancestor meta-law remodeling process
  or corrections to existing time law anchors
- **Tooling** — improvements to `scripts/verify-upstream-transfer.js` or the generation
  scripts (path correctness, output format, error handling)
- **Documentation** — corrections to `EXCLUSION_CRITERIA.md`, `README.md`, or `AGENTS.md`
  where the documented state diverges from the actual manifest state
- **Verification** — additional assertions in `verify-upstream-transfer.js` that strengthen
  the transfer readiness check

## What Is Out of Scope

- **Inventing new laws** — do not add laws not traceable to the source corpus or the ancestor
  meta-law payload
- **Runtime redesign** — the upstream runtime architecture (interceptor, gravity, NSL, ledger
  flow) is defined in the runtime repo. This repo does not redesign it.
- **New law families beyond the current 12** — the family structure is locked for the current
  transfer cycle. Proposals for new families belong in a discussion issue first.

---

## Workflow

1. Fork the repo and create a branch off `main`
2. Make your changes
3. Run `npm run verify:upstream-transfer` — it must pass with all assertions green
4. Open a pull request with a clear description of what changed and why
5. Reference the manifest entry, law ID, or source record that justifies the change

CI will run `verify:upstream-transfer` automatically on every PR. A PR that breaks any
assertion will not be merged.

---

## Reading the Corpus Before Contributing

Before contributing to the law body itself:

1. Read `README.md` — understand the corpus structure and verified counts
2. Read `AGENTS.md` — the hard rules apply to human contributors too
3. Read `EXCLUSION_CRITERIA.md` — understand why 65,870 laws were excluded and how the
   categories map to the manifest
4. Read `UPSTREAM_TRANSFER_CONTRACT.json` — understand what the transfer target expects
5. Check `data/working/base-law-families/manifest.json` — this is the source of truth for
   surviving law counts per family

---

## Hard Rules (from AGENTS.md)

These apply to all contributors:

- **No drift** — do not paraphrase away load-bearing meaning. Do not silently merge distinct
  laws. Do not silently delete laws.
- **No invention** — do not add laws not present in or derivable from the source corpus.
- **Source trace must survive** — every law must be traceable to a source record.
- **Preserve before trimming** — if a law looks redundant, mark it for review. Do not remove
  it unilaterally.
- **Agent Buccet identity only** — remodel toward Agent Buccet naming. Do not reintroduce
  ancestor-system framing in outputs.

---

## Code of Conduct

Be direct, technical, and honest. The law body is the thing. If you disagree with a trim
decision or a coverage call, open an issue and make the case with evidence from the manifest.

---

## Questions

Open an issue. Label it `question` if it's about corpus coverage, `bug` if something in
the manifest or docs is wrong, `enhancement` for tooling improvements.
