# Coding Substrate Alignment

- planet: `ability`
- ontology: `aligned`
- substrate features: `micro-emitter`, `post-fill semantic correction`, `slot-local fail-closed gating`
- integrated inputs:
  - `CODEX NEEDS/Micro-Emitter.txt`
  - `CODEX NEEDS/post-fill semantic correction loop.txt`

## Active Files

- `lib/lml/coding-micro-emitter.ts`
- `lib/lml/coding-post-fill-correction.ts`
- `lib/lml/coding-body-fill.ts`
- `lib/lml/coding-substrate-laws.ts`

## Laws

- `ABILITY.CODING.166`
- `ABILITY.CODING.167`
- `ABILITY.CODING.168`
- `ABILITY.CODING.169`
- `ABILITY.CODING.170`

## Alignment

- micro-emitter prompt builder is active in slot fill
- single-slot emission gate is active before generated slot admission
- post-fill rollback/auth-bypass audit is active before generated slot admission
- failed post-fill audit collapses to scaffold fallback
